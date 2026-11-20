const formats = {
  square: { width: 1080, height: 1080, label: '1080 × 1080' },
  portrait: { width: 1080, height: 1350, label: '1080 × 1350' },
  landscape: { width: 1920, height: 1080, label: '1920 × 1080' },
};

const colorways = {
  sunset: { pink: '#f4939e', gold: '#ffd09c', blue: '#354a74', aqua: '#7bc3c2', shade: '#231a32' },
  lagoon: { pink: '#6cc8cf', gold: '#e3f3cb', blue: '#2b4d78', aqua: '#94f0df', shade: '#101f38' },
  rose: { pink: '#ff8297', gold: '#ffcba9', blue: '#60315f', aqua: '#f4a1bd', shade: '#32142d' },
};

const canvas = document.querySelector('#poster');
const ctx = canvas.getContext('2d', { alpha: false });
const captionInput = document.querySelector('#captionInput');
const kickerInput = document.querySelector('#kickerInput');
const photoInput = document.querySelector('#photoInput');
const panelList = document.querySelector('#panelList');
const photoLibrary = document.querySelector('#photoLibrary');
const formatReadout = document.querySelector('#canvasReadout');
const zoomSlider = document.querySelector('#zoomSlider');
const zoomValue = document.querySelector('#zoomValue');
const toast = document.querySelector('#toast');

const state = {
  format: 'portrait',
  theme: 'sunset',
  selectedPanel: 0,
  photos: [],
  panels: Array.from({ length: 3 }, () => ({ image: null, zoom: 1, x: 0, y: 0 })),
  drag: null,
};

const panelNames = ['A / THE ARRIVAL', 'B / THE DETOUR', 'C / LAST CALL'];
let toastTimer;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function previewDimensions() {
  const { width, height } = formats[state.format];
  const maxWidth = Math.min(560, document.querySelector('#canvasWell').clientWidth - 24);
  const maxHeight = Math.min(window.innerHeight * 0.68, 700);
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function fitCanvas(element, width, height) {
  element.width = width;
  element.height = height;
}

function paintBackdrop(context, box, palette, panelIndex) {
  const { x, y, width, height } = box;
  const sky = context.createLinearGradient(x, y, x + width * 0.12, y + height);
  sky.addColorStop(0, palette.gold);
  sky.addColorStop(0.34, palette.pink);
  sky.addColorStop(0.7, palette.blue);
  sky.addColorStop(1, palette.shade);
  context.fillStyle = sky;
  context.fillRect(x, y, width, height);

  const sunX = x + width * (0.7 - panelIndex * 0.045);
  const sunY = y + height * 0.38;
  const radius = Math.min(width, height) * 0.22;
  const glow = context.createRadialGradient(sunX, sunY, radius * 0.1, sunX, sunY, radius * 1.35);
  glow.addColorStop(0, '#fff0c9');
  glow.addColorStop(0.42, palette.gold);
  glow.addColorStop(1, `${palette.gold}00`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(sunX, sunY, radius * 1.35, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#fff0c9';
  context.globalAlpha = 0.83;
  context.beginPath();
  context.arc(sunX, sunY, radius * 0.58, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const horizon = y + height * 0.68;
  const buildings = 13;
  for (let i = 0; i < buildings; i += 1) {
    const seed = (i * 37 + panelIndex * 19) % 67;
    const buildingWidth = width / (buildings + 1) * (0.72 + (seed % 9) / 22);
    const buildingHeight = height * (0.1 + (seed % 23) / 100);
    const bx = x + (i / buildings) * width - buildingWidth * 0.4;
    const by = horizon - buildingHeight;
    context.fillStyle = i % 3 === 0 ? '#172139' : '#1c203a';
    context.fillRect(bx, by, buildingWidth, buildingHeight + height * 0.36);
    context.fillStyle = i % 2 === 0 ? '#ffcc8b' : '#77dfd3';
    context.globalAlpha = 0.4;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const wx = bx + buildingWidth * (0.2 + column * 0.25);
        const wy = by + buildingHeight * (0.22 + row * 0.18);
        if (wx < x + width - 4 && wy < horizon) context.fillRect(wx, wy, Math.max(1, buildingWidth * 0.07), Math.max(2, buildingHeight * 0.035));
      }
    }
    context.globalAlpha = 1;
  }
  const road = context.createLinearGradient(0, horizon, 0, y + height);
  road.addColorStop(0, '#17182c');
  road.addColorStop(1, '#090f1c');
  context.fillStyle = road;
  context.fillRect(x, horizon, width, height - (horizon - y));
  context.strokeStyle = `${palette.aqua}99`;
  context.lineWidth = Math.max(1, width * 0.003);
  context.beginPath();
  context.moveTo(x + width * 0.12, y + height);
  context.lineTo(x + width * 0.46, horizon);
  context.moveTo(x + width * 0.89, y + height);
  context.lineTo(x + width * 0.54, horizon);
  context.stroke();
  context.strokeStyle = `${palette.gold}99`;
  context.lineWidth = Math.max(1, width * 0.002);
  context.beginPath();
  context.moveTo(x + width * 0.5, y + height * 0.98);
  context.lineTo(x + width * 0.5, horizon + height * 0.04);
  context.stroke();

  context.fillStyle = '#fff4d8';
  context.globalAlpha = 0.52;
  for (let i = 0; i < 46; i += 1) {
    const sx = x + ((i * 97 + panelIndex * 43) % 997) / 997 * width;
    const sy = y + ((i * 43 + 9) % 101) / 101 * height * 0.53;
    context.fillRect(sx, sy, Math.max(1, width * 0.0018), Math.max(1, width * 0.0018));
  }
  context.globalAlpha = 1;
}

function panelLayout(width, height) {
  const margin = Math.round(width * 0.055);
  const gap = Math.round(width * 0.014);
  const top = Math.round(height * 0.112);
  const gridHeight = Math.round(height * (width / height > 1.3 ? 0.53 : 0.595));
  const heroHeight = Math.round(gridHeight * 0.635);
  const boxWidth = width - margin * 2;
  return [
    { x: margin, y: top, width: boxWidth, height: heroHeight },
    { x: margin, y: top + heroHeight + gap, width: (boxWidth - gap) / 2, height: gridHeight - heroHeight - gap },
    { x: margin + (boxWidth + gap) / 2, y: top + heroHeight + gap, width: (boxWidth - gap) / 2, height: gridHeight - heroHeight - gap },
  ];
}

function drawPanel(context, box, panel, palette, index, width, height) {
  const radius = Math.max(5, width * 0.009);
  context.save();
  roundedRect(context, box.x, box.y, box.width, box.height, radius);
  context.clip();
  if (panel.image?.complete && panel.image.naturalWidth) {
    const image = panel.image;
    const zoom = panel.zoom;
    const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight) * zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const centerX = box.x + box.width / 2 + panel.x * Math.max(0, drawWidth - box.width) / 2;
    const centerY = box.y + box.height / 2 + panel.y * Math.max(0, drawHeight - box.height) / 2;
    context.drawImage(image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
    context.fillStyle = palette.pink;
    context.globalAlpha = 0.13;
    context.globalCompositeOperation = 'screen';
    context.fillRect(box.x, box.y, box.width, box.height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  } else {
    paintBackdrop(context, box, palette, index);
  }

  const wash = context.createLinearGradient(box.x, box.y, box.x + box.width * 0.1, box.y + box.height);
  wash.addColorStop(0, '#ffe3c222');
  wash.addColorStop(0.48, '#f4a3bc08');
  wash.addColorStop(1, '#0a0c1bdb');
  context.fillStyle = wash;
  context.fillRect(box.x, box.y, box.width, box.height);

  const glint = context.createLinearGradient(box.x, box.y, box.x + box.width * 0.72, box.y);
  glint.addColorStop(0, `${palette.gold}00`);
  glint.addColorStop(0.54, `${palette.gold}29`);
  glint.addColorStop(1, `${palette.gold}00`);
  context.fillStyle = glint;
  context.fillRect(box.x, box.y + box.height * 0.085, box.width, Math.max(1, width * 0.0013));

  context.fillStyle = '#10111caa';
  roundedRect(context, box.x + width * 0.018, box.y + height * 0.025, width * 0.19, height * 0.029, width * 0.008);
  context.fill();
  context.font = `700 ${Math.max(8, width * 0.009)}px system-ui, sans-serif`;
  context.fillStyle = '#f7f1e9';
  context.textBaseline = 'middle';
  context.fillText(`0${index + 1}  /  ${['CROSS TOWN', 'SIDE STREET', 'THE WATERLINE'][index]}`, box.x + width * 0.029, box.y + height * 0.039);

  if (index === 0) {
    context.save();
    context.globalAlpha = 0.74;
    context.strokeStyle = palette.gold;
    context.lineWidth = Math.max(1, width * 0.0014);
    const cx = box.x + box.width * 0.82;
    const cy = box.y + box.height * 0.36;
    context.beginPath();
    context.arc(cx, cy, box.width * 0.085, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.35;
    context.beginPath();
    context.arc(cx, cy, box.width * 0.112, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  context.restore();
  context.save();
  roundedRect(context, box.x, box.y, box.width, box.height, radius);
  context.strokeStyle = `${palette.gold}aa`;
  context.lineWidth = Math.max(1, width * 0.0013);
  context.stroke();
  context.restore();
}

function captionLines(text, maxWidth, context, fontSize) {
  context.font = `900 ${fontSize}px system-ui, sans-serif`;
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['YOUR CITY'];
}

function drawCover(context, width, height) {
  const palette = colorways[state.theme];
  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#11121e';
  context.fillRect(0, 0, width, height);

  const outer = width * 0.025;
  const edge = context.createLinearGradient(0, 0, width, height);
  edge.addColorStop(0, `${palette.gold}cc`);
  edge.addColorStop(0.52, `${palette.pink}77`);
  edge.addColorStop(1, `${palette.aqua}cc`);
  context.strokeStyle = edge;
  context.lineWidth = Math.max(1, width * 0.002);
  context.strokeRect(outer, outer, width - outer * 2, height - outer * 2);

  const margin = width * 0.055;
  context.fillStyle = '#e7e0dc';
  context.font = `700 ${Math.max(8, width * 0.012)}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  context.fillText('SUNSET CIRCUIT   /   FIELD NOTES', margin, height * 0.056);
  context.textAlign = 'right';
  context.fillStyle = palette.gold;
  context.fillText('VOLUME 06     •     1986', width - margin, height * 0.056);
  context.textAlign = 'left';
  context.fillStyle = `${palette.gold}55`;
  context.fillRect(margin, height * 0.083, width - margin * 2, Math.max(1, width * 0.001));

  const boxes = panelLayout(width, height);
  boxes.forEach((box, index) => drawPanel(context, box, state.panels[index], palette, index, width, height));

  const landscape = width / height > 1.3;
  const titleSize = landscape ? height * 0.125 : width * 0.112;
  const usable = width - margin * 2.12;
  const titleTop = height * (landscape ? 0.69 : 0.735);
  const titleBottom = height * 0.895;
  let fittedSize = titleSize;
  let title = captionLines(captionInput.value || 'YOUR CITY', usable, context, fittedSize).slice(0, 3);
  while (fittedSize > width * 0.035 && title.length * fittedSize > titleBottom - titleTop) {
    fittedSize *= 0.94;
    title = captionLines(captionInput.value || 'YOUR CITY', usable, context, fittedSize).slice(0, 3);
  }
  const lineHeight = fittedSize * 0.83;
  const shown = title;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.font = `900 ${fittedSize}px system-ui, sans-serif`;
  context.lineJoin = 'bevel';
  context.lineWidth = Math.max(2, width * 0.003);
  context.strokeStyle = '#11121e';
  context.shadowColor = '#0a0915';
  context.shadowBlur = width * 0.015;
  context.shadowOffsetX = width * 0.006;
  context.shadowOffsetY = width * 0.008;
  shown.forEach((line, index) => {
    const y = titleTop + index * lineHeight;
    context.strokeText(line, margin, y, usable);
    context.fillStyle = index === 0 ? '#fff2df' : palette.gold;
    context.fillText(line, margin, y, usable);
  });
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;

  const footerY = height * 0.948;
  context.fillStyle = '#eee6e2';
  context.font = `650 ${Math.max(8, width * 0.012)}px system-ui, sans-serif`;
  const kicker = kickerInput.value.trim().toUpperCase() || 'EVERY EXIT HAS A STORY';
  context.fillText(kicker.slice(0, 46), margin, footerY);
  context.textAlign = 'right';
  context.fillStyle = palette.aqua;
  context.font = `700 ${Math.max(8, width * 0.011)}px system-ui, sans-serif`;
  context.fillText('MIAMI / AFTER HOURS', width - margin, footerY);
  context.textAlign = 'left';
  context.fillStyle = `${palette.gold}70`;
  context.fillRect(margin, height * 0.919, width - margin * 2, Math.max(1, width * 0.001));

  const stampX = width - margin - width * 0.056;
  const stampY = height * 0.84;
  context.strokeStyle = `${palette.aqua}cc`;
  context.lineWidth = Math.max(1, width * 0.0017);
  context.beginPath();
  context.arc(stampX, stampY, width * 0.03, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#f7ede7';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `800 ${Math.max(7, width * 0.008)}px system-ui, sans-serif`;
  context.fillText('SC', stampX, stampY);
  context.textAlign = 'left';
  context.restore();
}

function paintPreview() {
  const { width, height } = previewDimensions();
  fitCanvas(canvas, width, height);
  drawCover(ctx, width, height);
  formatReadout.innerHTML = `${formats[state.format].label} <i>PNG</i>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function updatePhotoCount() {
  document.querySelector('#photoCount').textContent = String(state.photos.length).padStart(2, '0');
}

function renderPhotos() {
  photoLibrary.replaceChildren();
  if (!state.photos.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    empty.innerHTML = '<span class="empty-icon">▧</span><span>Your story starts with<br>one good photo.</span>';
    photoLibrary.append(empty);
    updatePhotoCount();
    return;
  }
  state.photos.forEach((photo, index) => {
    const tile = document.createElement('button');
    tile.className = `photo-tile${state.panels[state.selectedPanel].image === photo.image ? ' selected' : ''}`;
    tile.type = 'button';
    tile.title = `Place ${photo.name} into panel ${String.fromCharCode(65 + state.selectedPanel)}`;
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = photo.name;
    const label = document.createElement('span');
    label.textContent = photo.name || `PHOTO ${index + 1}`;
    tile.append(image, label);
    tile.addEventListener('click', () => assignPhoto(photo, state.selectedPanel));
    photoLibrary.append(tile);
  });
  updatePhotoCount();
}

function renderPanels() {
  panelList.replaceChildren();
  state.panels.forEach((panel, index) => {
    const row = document.createElement('button');
    row.className = `panel-row${state.selectedPanel === index ? ' active' : ''}`;
    row.type = 'button';
    row.setAttribute('aria-pressed', String(state.selectedPanel === index));
    const thumb = document.createElement('span');
    thumb.className = 'panel-thumb';
    if (panel.image) {
      const image = document.createElement('img');
      image.src = panel.image.src;
      image.alt = '';
      thumb.append(image);
    }
    const copy = document.createElement('span');
    copy.className = 'panel-row-copy';
    const title = document.createElement('strong');
    title.textContent = panelNames[index];
    const subtitle = document.createElement('small');
    subtitle.textContent = panel.image ? 'PHOTO / REFRAME' : 'CITY ART / BUILT IN';
    copy.append(title, subtitle);
    const number = document.createElement('span');
    number.className = 'panel-number';
    number.textContent = `0${index + 1}`;
    row.append(thumb, copy, number);
    row.addEventListener('click', () => selectPanel(index));
    panelList.append(row);
  });
}

function selectPanel(index) {
  state.selectedPanel = index;
  document.querySelector('#selectedPanelName').textContent = String.fromCharCode(65 + index);
  zoomSlider.value = String(state.panels[index].zoom);
  zoomValue.textContent = `${state.panels[index].zoom.toFixed(1)}×`;
  renderPanels();
  renderPhotos();
  paintPreview();
}

function assignPhoto(photo, index) {
  state.panels[index].image = photo.image;
  state.panels[index].zoom = 1;
  state.panels[index].x = 0;
  state.panels[index].y = 0;
  selectPanel(index);
  showToast(`Photo added to panel ${String.fromCharCode(65 + index)}.`);
}

function loadPhotos(files) {
  const incoming = [...files].filter((file) => file.type.startsWith('image/'));
  if (!incoming.length) return;
  const firstIndex = state.photos.length;
  for (const file of incoming) {
    const image = new Image();
    const url = URL.createObjectURL(file);
    const photo = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), url, image };
    image.onload = () => {
      renderPhotos();
      renderPanels();
      paintPreview();
    };
    image.src = url;
    state.photos.push(photo);
  }
  if (incoming.length === 1) {
    state.panels.forEach((panel) => {
      panel.image = state.photos[firstIndex].image;
      panel.zoom = 1;
      panel.x = 0;
      panel.y = 0;
    });
    selectPanel(0);
    showToast('Your photo now fills all three story panels.');
  } else {
    incoming.slice(0, 3).forEach((_, index) => {
      const panel = state.panels[index];
      panel.image = state.photos[firstIndex + index].image;
      panel.zoom = 1;
      panel.x = 0;
      panel.y = 0;
    });
    selectPanel(0);
    showToast(`${incoming.length} photos added to your roll.`);
  }
  renderPhotos();
  renderPanels();
  paintPreview();
}

function setFormat(format) {
  if (!formats[format]) return;
  state.format = format;
  document.querySelectorAll('.format-switch button').forEach((button) => {
    button.classList.toggle('active', button.dataset.size === format);
  });
  paintPreview();
}

function exportCover(format = state.format) {
  if (!formats[format]) throw new Error('Choose one of the three cover sizes.');
  setFormat(format);
  const { width, height } = formats[format];
  const output = document.createElement('canvas');
  fitCanvas(output, width, height);
  drawCover(output.getContext('2d', { alpha: false }), width, height);
  const dataUrl = output.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `sunset-circuit-${format}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.latestExport = { format, width, height, dataUrl };
  showToast(`PNG exported · ${formats[format].label}`);
  return dataUrl;
}

function panelAt(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const x = (clientX - bounds.left) / bounds.width * canvas.width;
  const y = (clientY - bounds.top) / bounds.height * canvas.height;
  return panelLayout(canvas.width, canvas.height).findIndex((box) => x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height);
}

canvas.addEventListener('pointerdown', (event) => {
  const index = panelAt(event.clientX, event.clientY);
  if (index < 0) return;
  selectPanel(index);
  state.drag = { index, x: event.clientX, y: event.clientY };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.drag) return;
  const bounds = canvas.getBoundingClientRect();
  const panel = panelLayout(canvas.width, canvas.height)[state.drag.index];
  const crop = state.panels[state.drag.index];
  crop.x = clamp(crop.x + (event.clientX - state.drag.x) / bounds.width * canvas.width / panel.width * 1.7, -1, 1);
  crop.y = clamp(crop.y + (event.clientY - state.drag.y) / bounds.height * canvas.height / panel.height * 1.7, -1, 1);
  state.drag.x = event.clientX;
  state.drag.y = event.clientY;
  paintPreview();
});

function stopDragging() {
  state.drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);

document.querySelector('#addPhotoButton').addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (event) => {
  loadPhotos(event.target.files);
  event.target.value = '';
});
document.querySelectorAll('.format-switch button').forEach((button) => button.addEventListener('click', () => setFormat(button.dataset.size)));
document.querySelectorAll('.treatment').forEach((button) => button.addEventListener('click', () => {
  state.theme = button.dataset.theme;
  document.querySelectorAll('.treatment').forEach((item) => item.classList.toggle('active', item === button));
  paintPreview();
}));
captionInput.addEventListener('input', () => {
  document.querySelector('#captionCount').textContent = `${captionInput.value.length} / 36`;
  paintPreview();
});
kickerInput.addEventListener('input', paintPreview);
zoomSlider.addEventListener('input', () => {
  const panel = state.panels[state.selectedPanel];
  panel.zoom = Number(zoomSlider.value);
  zoomValue.textContent = `${panel.zoom.toFixed(1)}×`;
  paintPreview();
});
document.querySelector('#exportButton').addEventListener('click', () => {
  const button = document.querySelector('#exportButton');
  button.disabled = true;
  try { exportCover(); } finally { setTimeout(() => { button.disabled = false; }, 350); }
});
document.querySelector('#resetButton').addEventListener('click', () => {
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.photos = [];
  state.panels = Array.from({ length: 3 }, () => ({ image: null, zoom: 1, x: 0, y: 0 }));
  state.theme = 'sunset';
  captionInput.value = 'CITY AFTERGLOW';
  kickerInput.value = 'EVERY EXIT HAS A STORY';
  document.querySelector('#captionCount').textContent = `${captionInput.value.length} / 36`;
  document.querySelectorAll('.treatment').forEach((item) => item.classList.toggle('active', item.dataset.theme === state.theme));
  zoomSlider.value = '1';
  zoomValue.textContent = '1.0×';
  selectPanel(0);
  showToast('A fresh city, ready for your story.');
});
window.addEventListener('resize', paintPreview);

window.exportCover = exportCover;
window.coverStudio = { formats, state, paintPreview };
renderPanels();
renderPhotos();
paintPreview();
