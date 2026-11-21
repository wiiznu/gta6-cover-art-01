(() => {
  'use strict';
  // Studio state: all user images live only in this page's memory.
  const $ = (id) => document.getElementById(id);
  const canvas = $('coverCanvas');
  const context = canvas.getContext('2d');
  const sizes = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080] };
  const panelNames = ['Hero', 'Detail', 'Street'];
  const freshPanel = () => ({ photo: -1, zoom: 1, x: 0, y: 0 });
  const state = {
    photos: [], panels: Array.from({ length: 3 }, freshPanel), selected: 0,
    layout: 'portrait', grade: 'sunset', caption: 'THE CITY NEVER COOLS',
  };
  const palettes = {
    sunset: { sky: '#40225d', horizon: '#f47a91', sun: '#ffcf87', ink: '#211c39', light: '#ffb685', water: '#814671' },
    neon: { sky: '#171e50', horizon: '#aa338f', sun: '#ff82d6', ink: '#101b37', light: '#63f2df', water: '#214a74' },
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let drag = null;
  let frame = 0;
  let loading = false;
  let exporting = false;
  function announce(message) {
    $('exportStatus').textContent = message;
  }
  function scheduleRender() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderCover(context, canvas.width, canvas.height, state.layout, true);
    });
  }

  // Photo loading: local object URLs only; failures leave other photos intact.
  function decodePhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) {
          URL.revokeObjectURL(url);
          reject(new Error('Empty image or image over 50 megapixels'));
        } else resolve({ image, url, name: file.name });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unsupported or damaged image'));
      };
      image.src = url;
    });
  }
  async function loadPhotos(fileList) {
    if (loading) return announce('Please wait for the current photos to finish loading.');
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    const room = 8 - state.photos.length;
    if (!files.length) return announce('Choose image files such as JPG, PNG or WebP.');
    if (!room) return announce('Eight photos are loaded. Reset the studio to start a new set.');
    loading = true;
    $('resetButton').disabled = true;
    announce('Decoding your local photos…');
    let failed = 0;
    const before = state.photos.length;
    try {
      for (const file of files.slice(0, room)) {
        if (file.size > 40 * 1024 * 1024) { failed++; continue; }
        try { state.photos.push(await decodePhoto(file)); }
        catch { failed++; }
      }
      if (before === 0 && state.photos.length) {
        state.panels.forEach((panel, index) => { panel.photo = index % state.photos.length; });
      } else if (state.photos.length > before) {
        Object.assign(state.panels[state.selected], freshPanel(), { photo: before });
      }
      syncControls();
      scheduleRender();
      const added = state.photos.length - before;
      announce(`${added} photo${added === 1 ? '' : 's'} added locally.${failed ? ` ${failed} could not be loaded (40 MB / 50 MP limits).` : ''}${files.length > room ? ' Only the first eight photos fit.' : ''}`);
    } finally {
      loading = false;
      $('resetButton').disabled = false;
      $('photoInput').value = '';
    }
  }

  $('photoInput').addEventListener('change', (event) => loadPhotos(event.target.files));
  for (const type of ['dragenter', 'dragover']) {
    $('dropZone').addEventListener(type, (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      $('dropZone').classList.add('is-dragging');
    });
  }
  $('dropZone').addEventListener('dragleave', (event) => {
    if (!$('dropZone').contains(event.relatedTarget)) $('dropZone').classList.remove('is-dragging');
  });
  $('dropZone').addEventListener('drop', (event) => {
    event.preventDefault();
    $('dropZone').classList.remove('is-dragging');
    loadPhotos(event.dataTransfer.files);
  });
  // Prevent an accidentally missed drop from navigating away from the studio.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());

  // Panel reframing: normalized pan maps to available crop overflow, never blank edges.
  function panelRects(width, height, layout) {
    const g = Math.max(8, Math.round(width * .009));
    const x = g, y = g, w = width - g * 2, h = height - g * 2;
    const heroWidth = Math.round(w * (layout === 'landscape' ? .64 : .66));
    const topHeight = Math.round(h * .73);
    const sideWidth = w - heroWidth - g;
    return [
      { x, y, w: heroWidth, h: topHeight, index: 0 },
      { x: x + heroWidth + g, y, w: sideWidth, h: Math.round((topHeight - g) * .51), index: 1 },
      { x: x + heroWidth + g, y: y + Math.round((topHeight - g) * .51) + g,
        w: sideWidth, h: topHeight - Math.round((topHeight - g) * .51) - g, index: 2 },
      { x, y: y + topHeight + g, w, h: h - topHeight - g, index: 3 },
    ];
  }
  function cropGeometry(image, rect, panel) {
    const scale = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight) * panel.zoom;
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    return { w, h, overflowX: w - rect.w, overflowY: h - rect.h,
      x: rect.x - (w - rect.w) * (1 - panel.x) / 2,
      y: rect.y - (h - rect.h) * (1 - panel.y) / 2 };
  }
  function pointerPosition(event) {
    const box = canvas.getBoundingClientRect();
    // Canvas CSS uses object-fit: contain; account for letterboxing on tall screens.
    const scale = Math.min(box.width / canvas.width, box.height / canvas.height);
    const left = box.left + (box.width - canvas.width * scale) / 2;
    const top = box.top + (box.height - canvas.height * scale) / 2;
    return { x: (event.clientX - left) / scale, y: (event.clientY - top) / scale };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const point = pointerPosition(event);
    const rect = panelRects(canvas.width, canvas.height, state.layout).find((r) =>
      r.index < 3 && point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h);
    if (!rect) return;
    state.selected = rect.index;
    syncControls();
    scheduleRender();
    const panel = state.panels[state.selected];
    const photo = state.photos[panel.photo];
    if (!photo) return;
    drag = { point, rect, x: panel.x, y: panel.y, pointer: event.pointerId, panel };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const point = pointerPosition(event);
    const photo = state.photos[drag.panel.photo];
    const geometry = cropGeometry(photo.image, drag.rect, drag.panel);
    drag.panel.x = geometry.overflowX > .1 ? clamp(drag.x + 2 * (point.x - drag.point.x) / geometry.overflowX, -1, 1) : 0;
    drag.panel.y = geometry.overflowY > .1 ? clamp(drag.y + 2 * (point.y - drag.point.y) / geometry.overflowY, -1, 1) : 0;
    syncCrop();
    scheduleRender();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, () => { drag = null; });
  }
  for (const [id, key] of [['zoomSlider', 'zoom'], ['panX', 'x'], ['panY', 'y']]) {
    $(id).addEventListener('input', () => {
      state.panels[state.selected][key] = Number($(id).value);
      syncCrop();
      scheduleRender();
    });
  }
  $('resetCrop').addEventListener('click', () => {
    const panel = state.panels[state.selected];
    Object.assign(panel, { zoom: 1, x: 0, y: 0 });
    syncCrop();
    scheduleRender();
  });

  // Colour treatments: canvas filters plus gradient compositing apply to each photo.
  function applyGrade(ctx, rect) {
    const neon = state.grade === 'neon';
    const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    wash.addColorStop(0, neon ? '#2fe9e8' : '#ffbd79');
    wash.addColorStop(.52, neon ? '#ba3ba2' : '#ef797c');
    wash.addColorStop(1, neon ? '#38339a' : '#6b397a');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = .58;
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    shade.addColorStop(0, '#120d2400');
    shade.addColorStop(.5, '#120d2410');
    shade.addColorStop(1, '#120d24b8');
    ctx.fillStyle = shade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  function drawPhotoPanel(ctx, rect) {
    const panel = state.panels[rect.index];
    const photo = state.photos[panel.photo];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (photo) {
      const crop = cropGeometry(photo.image, rect, panel);
      ctx.filter = state.grade === 'neon' ? 'contrast(1.16) saturate(1.25)' : 'contrast(1.12) saturate(1.12)';
      ctx.drawImage(photo.image, crop.x, crop.y, crop.w, crop.h);
      ctx.filter = 'none';
      applyGrade(ctx, rect);
    } else drawCity(ctx, rect, rect.index);
    ctx.restore();
  }

  // City artwork: deterministic geometry, with no image assets or random dependencies.
  function drawPalm(ctx, x, base, height, lean, ink) {
    const crownX = x + height * lean, crownY = base - height;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(3, height * .034);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + height * lean * .2, base - height * .6, crownX, crownY);
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let leaf = 0; leaf < 9; leaf++) {
      const angle = leaf * Math.PI * 2 / 9;
      const reach = height * (.27 + .04 * Math.sin(leaf * 3));
      const endX = crownX + Math.cos(angle) * reach;
      const endY = crownY + Math.sin(angle) * reach * .5 + height * .09;
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo(crownX + Math.cos(angle) * reach * .6, crownY - height * .12, endX, endY);
      ctx.quadraticCurveTo(crownX + Math.cos(angle) * reach * .3, crownY + height * .04, crownX, crownY);
      ctx.fill();
    }
  }
  function drawCity(ctx, rect, variant = 0) {
    const p = palettes[state.grade];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.translate(rect.x, rect.y);
    const w = rect.w, h = rect.h;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, p.sky);
    sky.addColorStop(.58, p.horizon);
    sky.addColorStop(1, p.sun);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const radius = Math.min(w * .25, h * .32);
    const sunX = w * (.66 - variant * .05), sunY = h * .36;
    ctx.fillStyle = p.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = p.horizon;
    for (let stripe = 0; stripe < 7; stripe++) {
      ctx.fillRect(sunX - radius, sunY + stripe * radius * .135, radius * 2, radius * (.012 + stripe * .008));
    }
    ctx.restore();
    ctx.fillStyle = p.water;
    ctx.fillRect(0, h * .66, w, h * .34);
    for (let i = 0; i < 22; i++) {
      const x = (i / 21) * w;
      const buildingW = w / 18;
      const buildingH = h * (.13 + .26 * ((Math.sin(i * 7.13 + variant) + 1) / 2));
      const roof = h * .72 - buildingH;
      ctx.fillStyle = i % 3 ? p.ink : '#302640';
      ctx.fillRect(x, roof, buildingW, buildingH);
      if (i % 4 === 0) ctx.fillRect(x + buildingW * .43, roof - h * .045, buildingW * .08, h * .05);
      ctx.fillStyle = p.light;
      ctx.globalAlpha = .7;
      for (let row = 1; row < 8; row++) {
        if (row * h * .024 >= buildingH) break;
        for (let col = 1; col < 4; col++) {
          if ((row + col + i) % 3) ctx.fillRect(x + col * buildingW * .2, roof + row * h * .024, Math.max(1, buildingW * .08), Math.max(1, h * .007));
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.moveTo(w * .38, h * .72);
    ctx.lineTo(w * .56, h * .72);
    ctx.lineTo(w * 1.15, h);
    ctx.lineTo(-w * .3, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.light;
    ctx.lineWidth = Math.max(1, w * .003);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(w * .47 + side * w * .06, h * .73);
      ctx.lineTo(w * .47 + side * w * .7, h);
      ctx.stroke();
    }
    ctx.setLineDash([h * .025, h * .025]);
    ctx.beginPath();
    ctx.moveTo(w * .47, h * .76);
    ctx.lineTo(w * .47, h);
    ctx.stroke();
    ctx.setLineDash([]);
    drawPalm(ctx, w * .12, h * .94, h * .62, .12, p.ink);
    drawPalm(ctx, w * .88, h * .9, h * .5, -.1, p.ink);
    ctx.restore();
  }

  // Lettering: heavy local system fonts, fitted to the actual export dimensions.
  function fittedText(ctx, text, x, baseline, maxWidth, fontSize, fill, outline) {
    ctx.save();
    ctx.font = `900 ${fontSize}px Impact, Haettenschweiler, 'Arial Black', sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const width = ctx.measureText(text).width;
    ctx.translate(x, baseline);
    ctx.scale(Math.min(1, maxWidth / Math.max(1, width)), 1);
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = '#171223';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  function drawLettering(ctx, width, height, layout) {
    const wide = layout === 'landscape';
    const unit = Math.min(width, height);
    const left = width * .045;
    const fontSize = unit * (wide ? .155 : .145);
    const base = height * .69;
    const titleFill = ctx.createLinearGradient(0, base - fontSize * 1.65, 0, base);
    titleFill.addColorStop(0, '#fff5d9');
    titleFill.addColorStop(.55, state.grade === 'neon' ? '#8ef8ec' : '#ffcb8c');
    titleFill.addColorStop(1, state.grade === 'neon' ? '#ee83da' : '#fa8d9d');
    fittedText(ctx, 'CITY', left + unit * .005, base - fontSize * .94, width * .57, fontSize, titleFill, unit * .014);
    fittedText(ctx, 'AFTERGLOW', left, base, width * .9, fontSize, titleFill, unit * .014);
    ctx.save();
    ctx.fillStyle = '#161324e8';
    ctx.fillRect(width * .035, height * .755, width * .93, unit * .052);
    ctx.font = `800 ${unit * .022}px Arial, sans-serif`;
    ctx.fillStyle = '#fff0d1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.caption.toUpperCase(), width / 2, height * .755 + unit * .026, width * .87);
    ctx.textAlign = 'left';
    ctx.font = `700 ${unit * .012}px Arial, sans-serif`;
    ctx.fillStyle = '#ffe0b2';
    ctx.fillText('SUNSET CIRCUIT / A PERSONAL CITY STORY', width * .04, height * .965);
    ctx.restore();
  }
  function renderCover(ctx, width, height, layout, editor = false) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#171223';
    ctx.fillRect(0, 0, width, height);
    const rects = panelRects(width, height, layout);
    for (const rect of rects) {
      if (rect.index < 3) drawPhotoPanel(ctx, rect);
      else drawCity(ctx, rect, 3);
    }
    drawLettering(ctx, width, height, layout);
    if (editor && state.photos.length) {
      const rect = rects[state.selected];
      ctx.save();
      ctx.strokeStyle = '#a4fff1';
      ctx.lineWidth = Math.max(2, width * .002);
      ctx.setLineDash([width * .009, width * .006]);
      ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
      ctx.restore();
    }
  }

  // PNG exports: independent full-size canvases omit the editor selection frame.
  async function exportPNG(kind) {
    if (exporting) return;
    exporting = true;
    document.querySelectorAll('[data-size]').forEach((button) => { button.disabled = true; });
    announce('Rendering your full-resolution PNG…');
    try {
      const [width, height] = sizes[kind];
      const renderedGrade = state.grade;
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      renderCover(output.getContext('2d'), width, height, kind);
      const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG encoder returned no image');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sunset-circuit-${kind}-${renderedGrade}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      announce(`Downloaded ${width} × ${height} PNG. Your afterglow is ready.`);
    } catch (error) { announce(`Export failed: ${error.message}. Try a smaller format.`); }
    finally {
      exporting = false;
      document.querySelectorAll('[data-size]').forEach((button) => { button.disabled = false; });
    }
  }

  function syncCrop() {
    const panel = state.panels[state.selected];
    $('zoomSlider').value = panel.zoom;
    $('zoomReadout').textContent = `${panel.zoom.toFixed(2)}×`;
    $('panX').value = panel.x;
    $('panY').value = panel.y;
  }

  function syncControls() {
    $('photoCount').textContent = `${state.photos.length} / 8`;
    $('dropHint').hidden = state.photos.length > 0;
    $('photoTray').replaceChildren();
    if (!state.photos.length) {
      const empty = document.createElement('span');
      empty.className = 'empty-tray';
      empty.textContent = 'Your photo tray is waiting for a story.';
      $('photoTray').append(empty);
    }
    state.photos.forEach((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-thumb';
      button.classList.toggle('is-active', state.panels[state.selected].photo === index);
      button.setAttribute('aria-label', `Assign ${photo.name} to ${panelNames[state.selected]}`);
      button.setAttribute('aria-pressed', String(state.panels[state.selected].photo === index));
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = '';
      button.append(image);
      button.addEventListener('click', () => {
        Object.assign(state.panels[state.selected], freshPanel(), { photo: index });
        syncControls();
        scheduleRender();
      });
      $('photoTray').append(button);
    });
    document.querySelectorAll('#panelPicker button').forEach((button, index) => {
      button.classList.toggle('is-active', index === state.selected);
      button.setAttribute('aria-pressed', String(index === state.selected));
    });
    for (const key of ['layout', 'grade']) {
      document.querySelectorAll(`[data-${key}]`).forEach((button) => {
        const active = button.dataset[key] === state[key];
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    const [width, height] = sizes[state.layout];
    canvas.width = Math.round(width * Math.min(1, 1080 / Math.max(width, height)));
    canvas.height = Math.round(height * Math.min(1, 1080 / Math.max(width, height)));
    $('layoutReadout').textContent = `${state.layout.toUpperCase()} / FOUR PANELS`;
    $('captionCount').textContent = `${state.caption.length} / 54`;
    syncCrop();
  }

  panelNames.forEach((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${String(index + 1).padStart(2, '0')} ${name}`;
    button.addEventListener('click', () => { state.selected = index; syncControls(); scheduleRender(); });
    $('panelPicker').append(button);
  });
  for (const key of ['layout', 'grade']) {
    document.querySelectorAll(`[data-${key}]`).forEach((button) => {
      button.addEventListener('click', () => { state[key] = button.dataset[key]; syncControls(); scheduleRender(); });
    });
  }
  $('captionInput').addEventListener('input', () => {
    state.caption = $('captionInput').value;
    $('captionCount').textContent = `${state.caption.length} / 54`;
    scheduleRender();
  });
  document.querySelectorAll('[data-size]').forEach((button) => {
    button.addEventListener('click', () => exportPNG(button.dataset.size));
  });
  $('resetButton').addEventListener('click', () => {
    drag = null;
    state.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    Object.assign(state, { photos: [], panels: Array.from({ length: 3 }, freshPanel), selected: 0,
      layout: 'portrait', grade: 'sunset', caption: 'THE CITY NEVER COOLS' });
    $('captionInput').value = state.caption;
    syncControls();
    scheduleRender();
    announce('Studio reset. Add a fresh scene.');
  });
  syncControls();
  scheduleRender();
})();
