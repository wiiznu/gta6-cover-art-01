import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browser = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux/chrome';
const captures = join(root, 'screenshots');

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePort);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

function makePngInspector(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('The exported cover did not have a valid PNG signature.');
  }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('PNG is missing its image header.');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function inspectJpeg(buffer) {
  if (buffer.subarray(0, 3).toString('hex') !== 'ffd8ff') throw new Error('Screenshot is not a JPEG image.');
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if ([0xd8, 0xd9, 0x01, ...Array.from({ length: 8 }, (_, index) => 0xd0 + index)].includes(marker)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += length + 2;
  }
  throw new Error('Screenshot has no JPEG size header.');
}

async function captureJpeg(send, options = {}) {
  let latest;
  for (const quality of [86, 76, 66, 56]) {
    const result = await send('Page.captureScreenshot', { format: 'jpeg', quality, fromSurface: true, ...options });
    latest = Buffer.from(result.data, 'base64');
    if (latest.length <= 262144) return latest;
  }
  throw new Error(`A browser screenshot is still too large (${latest.length} bytes).`);
}

function createProtocol(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
    else request.resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolveCall, rejectCall) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveCall, reject: rejectCall, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function until(readiness, message, timeout = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const value = await readiness();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  }
  throw new Error(`${message}${lastError ? ` (${lastError.message})` : ''}`);
}

async function evaluate(send, expression, options = {}) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
    ...options,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

const portraitCode = `(async () => {
  const photo = document.createElement("canvas");
  photo.width = 840;
  photo.height = 1120;
  const g = photo.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 760, 1120);
  sky.addColorStop(0, "#f3a9a4");
  sky.addColorStop(0.44, "#6b8a9b");
  sky.addColorStop(1, "#172d43");
  g.fillStyle = sky;
  g.fillRect(0, 0, 840, 1120);
  const sun = g.createRadialGradient(630, 255, 10, 630, 255, 220);
  sun.addColorStop(0, "#ffe6b3");
  sun.addColorStop(0.62, "#ffb98d");
  sun.addColorStop(1, "#ff9e9200");
  g.fillStyle = sun;
  g.fillRect(350, 0, 490, 560);
  g.globalAlpha = 0.46;
  for (let n = 0; n < 20; n++) {
    const x = (n * 89) % 840;
    const h = 80 + (n * 47) % 180;
    g.fillStyle = n % 2 ? "#26374a" : "#344957";
    g.fillRect(x, 515 - h, 34 + n % 5 * 8, h + 190);
    g.fillStyle = "#ffd699";
    for (let y = 530 - h; y < 515; y += 27) g.fillRect(x + 8, y, 4, 8);
  }
  g.globalAlpha = 1;
  const sea = g.createLinearGradient(0, 540, 0, 1120);
  sea.addColorStop(0, "#314c60");
  sea.addColorStop(1, "#192d41");
  g.fillStyle = sea;
  g.fillRect(0, 535, 840, 585);
  for (let n = 0; n < 85; n++) {
    const y = 570 + (n * 61) % 525;
    const x = (n * 137) % 840;
    g.globalAlpha = 0.1 + (n % 4) * 0.035;
    g.fillStyle = n % 2 ? "#f8c6a1" : "#9bd1cd";
    g.fillRect(x, y, 20 + (n * 19) % 105, n % 3 + 1);
  }
  g.globalAlpha = 1;
  const jacket = g.createLinearGradient(110, 610, 690, 1110);
  jacket.addColorStop(0, "#293447");
  jacket.addColorStop(0.5, "#192737");
  jacket.addColorStop(1, "#111d2c");
  g.fillStyle = jacket;
  g.beginPath();
  g.moveTo(115, 1120);
  g.lineTo(180, 760);
  g.quadraticCurveTo(285, 675, 350, 710);
  g.lineTo(455, 710);
  g.quadraticCurveTo(575, 673, 665, 770);
  g.lineTo(745, 1120);
  g.closePath();
  g.fill();
  g.strokeStyle = "#d28d81";
  g.globalAlpha = 0.7;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(416, 738);
  g.lineTo(410, 1115);
  g.moveTo(335, 755);
  g.lineTo(278, 890);
  g.stroke();
  g.globalAlpha = 1;
  const neck = g.createLinearGradient(370, 500, 470, 770);
  neck.addColorStop(0, "#cf9079");
  neck.addColorStop(1, "#855c56");
  g.fillStyle = neck;
  g.fillRect(358, 565, 126, 200);
  const face = g.createRadialGradient(370, 350, 35, 410, 425, 255);
  face.addColorStop(0, "#f0c09c");
  face.addColorStop(0.62, "#d49b7c");
  face.addColorStop(1, "#825b54");
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(420, 425, 172, 222, -0.04, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#c88972";
  g.beginPath();
  g.ellipse(244, 442, 31, 53, 0, 0, Math.PI * 2);
  g.ellipse(588, 442, 31, 53, 0, 0, Math.PI * 2);
  g.fill();
  const hair = g.createLinearGradient(260, 190, 585, 490);
  hair.addColorStop(0, "#1b2433");
  hair.addColorStop(1, "#43333c");
  g.fillStyle = hair;
  g.beginPath();
  g.moveTo(245, 450);
  g.quadraticCurveTo(215, 184, 406, 190);
  g.quadraticCurveTo(592, 166, 603, 367);
  g.lineTo(568, 388);
  g.quadraticCurveTo(496, 323, 435, 302);
  g.quadraticCurveTo(366, 368, 258, 366);
  g.closePath();
  g.fill();
  g.strokeStyle = "#efc5a3";
  g.globalAlpha = 0.5;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(419, 438, 173, 0.92, 2.2);
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = "#302e38";
  g.beginPath();
  g.ellipse(356, 423, 30, 12, 0.04, 0, Math.PI * 2);
  g.ellipse(478, 421, 30, 12, -0.04, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f6dbb8";
  g.beginPath();
  g.arc(359, 423, 5, 0, Math.PI * 2);
  g.arc(476, 421, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#905f56";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(376, 533);
  g.quadraticCurveTo(423, 553, 469, 526);
  g.stroke();
  g.fillStyle = "#f5ae92";
  g.globalAlpha = 0.6;
  g.beginPath();
  g.ellipse(304, 487, 46, 19, -0.2, 0, Math.PI * 2);
  g.ellipse(535, 484, 42, 17, 0.2, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "#edc79f";
  g.font = "600 18px sans-serif";
  g.fillText("AFTER HOURS   /   26° 08' N", 36, 1068);
  g.strokeStyle = "#fff2dc66";
  g.lineWidth = 2;
  g.strokeRect(16, 16, 808, 1088);
  const blob = await new Promise((resolveBlob) => photo.toBlob(resolveBlob, "image/png"));
  const testFile = new File([blob], "afterglow-portrait.png", { type: "image/png" });
  const transfer = new DataTransfer();
  transfer.items.add(testFile);
  const input = document.querySelector("#photoInput");
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return { width: photo.width, height: photo.height, name: testFile.name };
})()`;

let chrome;
let socket;
let browserSocket;
let temp;
try {
  temp = await mkdtemp(join(tmpdir(), 'sunset-circuit-'));
  await rm(captures, { recursive: true, force: true });
  await mkdir(captures, { recursive: true });
  const port = await unusedPort();
  const page = pathToFileURL(join(root, 'app', 'index.html')).href;
  chrome = spawn(browser, [
    '--headless',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${join(temp, 'profile')}`,
    '--window-size=1280,900',
    page,
  ], { stdio: 'ignore' });

  const target = await until(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) return null;
    const targets = await response.json();
    return targets.find((item) => item.type === 'page' && item.url.startsWith('file:'));
  }, 'Chromium did not expose a CDP page.');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await until(() => socket.readyState === WebSocket.OPEN, 'Could not connect to Chromium over CDP.');
  const send = createProtocol(socket);
  const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`);
  const browserInfo = await versionResponse.json();
  browserSocket = new WebSocket(browserInfo.webSocketDebuggerUrl);
  await until(() => browserSocket.readyState === WebSocket.OPEN, 'Could not connect to the Chromium browser target.');
  const sendBrowser = createProtocol(browserSocket);
  await send('Page.enable');
  await send('Runtime.enable');
  await sendBrowser('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temp });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await until(() => evaluate(send, 'document.readyState === "complete" && typeof window.exportCover === "function"'), 'The local editor did not finish loading.');

  const testPhoto = await evaluate(send, portraitCode);
  if (!testPhoto || testPhoto.width !== 840 || testPhoto.height !== 1120) throw new Error('Could not create the original test portrait.');
  await until(() => evaluate(send, 'window.coverStudio.state.photos.length === 1 && window.coverStudio.state.panels.every((panel) => panel.image && panel.image.complete)'), 'The test photo did not load into the poster panels.');
  await evaluate(send, 'document.querySelector("#kickerInput").value = "EVERY LAST LIGHT LEAVES A TRACE"; document.querySelector("#kickerInput").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#captionInput").value = "CITY / AFTERGLOW"; document.querySelector("#captionInput").dispatchEvent(new Event("input", { bubbles: true }));');

  const expected = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080] };
  const verified = [];
  for (const format of ['square', 'portrait', 'landscape']) {
    const dataUrl = await evaluate(send, `window.exportCover("${format}")`);
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) throw new Error(`${format} export was not a PNG data URL.`);
    const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    const dimensions = makePngInspector(png);
    const [width, height] = expected[format];
    if (dimensions.width !== width || dimensions.height !== height) throw new Error(`${format} export was ${dimensions.width}x${dimensions.height}, expected ${width}x${height}.`);
    const image = await evaluate(send, `(async () => { const blob = await (await fetch(window.latestExport.dataUrl)).blob(); const decoded = await createImageBitmap(blob); const valid = decoded.width === ${width} && decoded.height === ${height}; decoded.close(); return valid; })()`);
    if (!image) throw new Error(`${format} PNG could not be decoded by Chromium.`);
    const downloadedPath = join(temp, `sunset-circuit-${format}.png`);
    const saved = await until(async () => {
      const downloaded = await readFile(downloadedPath).catch(() => null);
      return downloaded?.equals(png) ? true : null;
    }, `${format} PNG did not finish downloading exactly as exported.`, 10000);
    if (!saved) throw new Error(`${format} export file is missing.`);
    verified.push({ format, width, height, bytes: png.length });

    if (format === 'portrait') {
      await writeFile(join(captures, '02-studio-with-photo.jpg'), await captureJpeg(send));
    }
    if (format === 'landscape') {
      await writeFile(join(captures, '03-wide-edition.jpg'), await captureJpeg(send));
    }
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const cover = await evaluate(send, '(async () => { const image = new Image(); image.src = window.latestExport.dataUrl; await image.decode(); document.documentElement.style.cssText = "margin:0;width:100%;height:100%;background:#11121e"; document.body.style.cssText = "margin:0;width:100vw;height:100vh;display:grid;place-items:center;background:#11121e"; image.style.cssText = "display:block;max-width:100vw;max-height:100vh;object-fit:contain"; document.body.replaceChildren(image); return { width: image.naturalWidth, height: image.naturalHeight }; })()');
  if (!cover || cover.width !== 1920 || cover.height !== 1080) throw new Error('The exported landscape cover did not reopen in Chromium.');
  await writeFile(join(captures, '01-city-afterglow-cover.jpg'), await captureJpeg(send));

  const checks = [];
  for (const name of ['01-city-afterglow-cover.jpg', '02-studio-with-photo.jpg', '03-wide-edition.jpg']) {
    const shotPath = join(captures, name);
    const shot = await readFile(shotPath);
    if (shot.length > 262144) throw new Error(`${name} is ${shot.length} bytes, over the 256 KiB screenshot cap.`);
    if (shot.subarray(-2).toString('hex') !== 'ffd9') throw new Error(`${name} is a truncated JPEG.`);
    const dimensions = inspectJpeg(shot);
    const longSide = Math.max(dimensions.width, dimensions.height);
    const shortSide = Math.min(dimensions.width, dimensions.height);
    if (longSide > 1280 || shortSide < 480) throw new Error(`${name} is ${dimensions.width}x${dimensions.height}, outside the screenshot dimensions.`);
    checks.push({ name, width: dimensions.width, height: dimensions.height, bytes: shot.length, realChromiumScreenshot: true });
  }
  console.log(JSON.stringify({ browser, testPhoto, exports: verified.map(({ format, width, height, bytes }) => ({ format, width, height, bytes })), screenshots: checks }, null, 2));
} catch (error) {
  console.error(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  if (browserSocket && browserSocket.readyState === WebSocket.OPEN) browserSocket.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await new Promise((resolveExit) => {
      const timer = setTimeout(resolveExit, 2500);
      chrome.once('exit', () => { clearTimeout(timer); resolveExit(); });
    });
  }
  if (temp) await rm(temp, { recursive: true, force: true });
}
