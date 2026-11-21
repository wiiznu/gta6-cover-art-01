(() => {
  'use strict';

  // Studio state: all photographs live only in this browser session.
  const $ = id => document.getElementById(id);
  const canvas = $('coverCanvas');
  const context = canvas.getContext('2d');
  const names = ['Hero', 'Detail', 'Street'];
  const dimensions = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    landscape: [1920, 1080]
  };
  const palette = {
    sunset: ['#61487f', '#f07899', '#ffba75', '#211c39', '#ffe6ad'],
    neon: ['#202252', '#aa3d9e', '#52dace', '#111d38', '#adfff0']
  };
  const freshCrop = () => ({ photo: null, zoom: 1, x: 0, y: 0 });
  const state = {
    photos: [], panels: names.map(freshCrop), selected: 0,
    layout: 'portrait', grade: 'sunset', caption: $('captionInput').value,
    loading: false, exporting: false, epoch: 0
  };
  let requestedFrame = 0;
  let drag = null;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const status = message => { $('exportStatus').textContent = message; };

  function schedule() {
    if (requestedFrame) return;
    requestedFrame = requestAnimationFrame(() => {
      requestedFrame = 0;
      renderCover(context, canvas.width, canvas.height, state.layout, true);
    });
  }

  function syncControls() {
    const crop = state.panels[state.selected];
    $('zoomSlider').value = crop.zoom;
    $('zoomReadout').value = `${crop.zoom.toFixed(2)}×`;
    $('panX').value = crop.x;
    $('panY').value = crop.y;
    $('photoCount').textContent = `${state.photos.length} / 8`;
    $('captionCount').value = `${state.caption.length} / 54`;
    $('dropHint').hidden = state.photos.length > 0;
    document.querySelectorAll('[data-panel]').forEach(button => {
      button.setAttribute('aria-pressed', String(+button.dataset.panel === state.selected));
    });
    document.querySelectorAll('[data-photo]').forEach(button => {
      button.setAttribute('aria-pressed', String(+button.dataset.photo === crop.photo));
    });
    for (const property of ['layout', 'grade']) {
      document.querySelectorAll(`[data-${property}]`).forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset[property] === state[property]));
      });
    }
  }

  // PHOTO LOADING — object URLs are local, and each is explicitly released.
  async function decodePhoto(file) {
    const url = URL.createObjectURL(file);
    const photo = new Image();
    try {
      await new Promise((resolve, reject) => {
        photo.onload = resolve;
        photo.onerror = () => reject(new Error('Unsupported or damaged image'));
        photo.src = url;
      });
      if (!photo.naturalWidth || !photo.naturalHeight) throw new Error('Empty image');
      // Bound retained memory while respecting the browser-decoded orientation.
      const ratio = Math.min(1, 3200 / Math.max(photo.naturalWidth, photo.naturalHeight));
      const bitmap = document.createElement('canvas');
      bitmap.width = Math.max(1, Math.round(photo.naturalWidth * ratio));
      bitmap.height = Math.max(1, Math.round(photo.naturalHeight * ratio));
      bitmap.getContext('2d').drawImage(photo, 0, 0, bitmap.width, bitmap.height);
      const thumbnail = document.createElement('canvas');
      const thumbScale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
      thumbnail.width = Math.max(1, Math.round(bitmap.width * thumbScale));
      thumbnail.height = Math.max(1, Math.round(bitmap.height * thumbScale));
      thumbnail.getContext('2d').drawImage(bitmap, 0, 0, thumbnail.width, thumbnail.height);
      return { bitmap, thumbnail: thumbnail.toDataURL('image/jpeg', .7), name: file.name };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadFiles(files) {
    if (state.loading) return status('Please wait for the current photos to finish.');
    state.loading = true;
    const epoch = state.epoch;
    let accepted = 0;
    let rejected = 0;
    status('Opening local photos…');
    try {
      for (const file of Array.from(files)) {
        if (state.photos.length >= 8) break;
        if (!file.type.startsWith('image/') || file.size > 30 * 1024 * 1024) {
          rejected++;
          continue;
        }
        try {
          const photo = await decodePhoto(file);
          if (epoch !== state.epoch) return;
          const index = state.photos.push(photo) - 1;
          if (index === 0) state.panels.forEach(panel => { panel.photo = 0; });
          if (index < 3) state.panels[index].photo = index;
          accepted++;
        } catch {
          rejected++;
        }
      }
      if (epoch !== state.epoch) return;
      rebuildTray();
      syncControls();
      schedule();
      status(`${accepted} photo(s) added. ${rejected ? `${rejected} unsupported or over 30 MB. ` : ''}Select a panel to reframe it. Maximum eight photos.`);
    } finally {
      state.loading = false;
      $('photoInput').value = '';
    }
  }

  function rebuildTray() {
    $('photoTray').replaceChildren();
    state.photos.forEach((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.photo = index;
      button.title = `Assign ${photo.name} to selected panel`;
      button.setAttribute('aria-label', button.title);
      const thumbnail = document.createElement('img');
      thumbnail.src = photo.thumbnail;
      thumbnail.alt = '';
      button.append(thumbnail);
      button.addEventListener('click', () => {
        state.panels[state.selected] = { ...freshCrop(), photo: index };
        syncControls();
        schedule();
      });
      $('photoTray').append(button);
    });
  }

  $('photoInput').addEventListener('change', event => loadFiles(event.target.files));
  const zone = $('dropZone');
  ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => {
    event.preventDefault();
    zone.classList.remove('is-dragging');
  }));
  zone.addEventListener('drop', event => loadFiles(event.dataTransfer.files));
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());

  // PANEL REFRAMING — normalized geometry keeps preview and exports coherent.
  function panelGeometry(layout) {
    if (layout === 'landscape') return [
      [0, 0, .64, .81], [.65, 0, .35, .395],
      [.65, .41, .35, .40], [0, .825, 1, .175]
    ];
    return [
      [0, 0, .655, .76], [.668, 0, .332, .373],
      [.668, .387, .332, .373], [0, .774, 1, .226]
    ];
  }

  function selectPanel(index) {
    state.selected = index;
    syncControls();
    schedule();
  }

  names.forEach((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.panel = index;
    button.textContent = name;
    button.addEventListener('click', () => selectPanel(index));
    $('panelPicker').append(button);
  });

  function cropMetrics(photo, panel, width, height) {
    const scale = Math.max(width / photo.width, height / photo.height) * panel.zoom;
    const drawWidth = photo.width * scale;
    const drawHeight = photo.height * scale;
    return { drawWidth, drawHeight, excessX: drawWidth - width, excessY: drawHeight - height };
  }

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height };
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const point = canvasPoint(event);
    const index = panelGeometry(state.layout).findIndex(([x, y, w, h], i) =>
      i < 3 && point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h);
    if (index < 0) return;
    selectPanel(index);
    const panel = state.panels[index];
    if (panel.photo === null) return;
    const rect = panelGeometry(state.layout)[index];
    const metrics = cropMetrics(state.photos[panel.photo].bitmap, panel,
      rect[2] * canvas.width, rect[3] * canvas.height);
    drag = { id: event.pointerId, point, x: panel.x, y: panel.y, metrics, index };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const point = canvasPoint(event);
    const panel = state.panels[drag.index];
    const { excessX, excessY } = drag.metrics;
    panel.x = excessX > .1 ? clamp(drag.x + 2 * (point.x - drag.point.x) * canvas.width / excessX, -1, 1) : 0;
    panel.y = excessY > .1 ? clamp(drag.y + 2 * (point.y - drag.point.y) * canvas.height / excessY, -1, 1) : 0;
    syncControls();
    schedule();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    canvas.addEventListener(type, () => { drag = null; });
  });

  [['zoomSlider', 'zoom'], ['panX', 'x'], ['panY', 'y']].forEach(([id, key]) => {
    $(id).addEventListener('input', event => {
      state.panels[state.selected][key] = Number(event.target.value);
      syncControls();
      schedule();
    });
  });
  $('resetCrop').addEventListener('click', () => {
    const photo = state.panels[state.selected].photo;
    state.panels[state.selected] = { ...freshCrop(), photo };
    syncControls();
    schedule();
  });

  // COLOUR TREATMENTS — per-panel canvas overlays tint actual photo pixels.
  function applyTreatment(ctx, width, height) {
    const colours = palette[state.grade];
    const wash = ctx.createLinearGradient(0, 0, width * .7, height);
    wash.addColorStop(0, colours[0]);
    wash.addColorStop(.55, colours[1]);
    wash.addColorStop(1, colours[2]);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = .65;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, '#14112c08');
    shade.addColorStop(.5, '#14112c00');
    shade.addColorStop(1, '#14112c9c');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
  }

  document.querySelectorAll('[data-grade]').forEach(button => {
    button.addEventListener('click', () => {
      state.grade = button.dataset.grade;
      syncControls();
      schedule();
    });
  });

  // CITY ARTWORK — deterministic original shapes, no downloaded art or fonts.
  function drawPalm(ctx, x, ground, height, lean) {
    ctx.save();
    ctx.strokeStyle = palette[state.grade][3];
    ctx.fillStyle = ctx.strokeStyle;
    const crownX = x + height * lean;
    const crownY = ground - height;
    ctx.lineWidth = height * .055;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.quadraticCurveTo(x + height * lean * .2, ground - height * .55, crownX, crownY);
    ctx.stroke();
    for (let leaf = 0; leaf < 9; leaf++) {
      const angle = leaf / 9 * Math.PI * 2;
      const tipX = crownX + Math.cos(angle) * height * .42;
      const tipY = crownY + Math.sin(angle) * height * .18 + height * .09;
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo((crownX + tipX) / 2, crownY - height * .16, tipX, tipY);
      ctx.quadraticCurveTo((crownX + tipX) / 2, crownY + height * .01, crownX, crownY);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCity(ctx, width, height, variant = 0) {
    const colours = palette[state.grade];
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, colours[0]);
    sky.addColorStop(.53, colours[1]);
    sky.addColorStop(1, colours[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const unit = Math.min(width, height);
    ctx.fillStyle = colours[4];
    ctx.beginPath();
    ctx.arc(width * (.64 - variant * .1), height * .34, unit * .23, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colours[1];
    for (let stripe = 0; stripe < 7; stripe++) {
      ctx.fillRect(width * .2, height * (.36 + stripe * .028), width * .75, height * .007);
    }
    const horizon = height * .76;
    for (let building = 0; building < 24; building++) {
      const x = width * building / 23;
      const bw = width / 20;
      const top = height * (.38 + (Math.sin(building * 7.3 + variant) + 1) * .14);
      ctx.fillStyle = colours[3];
      ctx.fillRect(x, top, bw, horizon - top);
      if (building % 4 === 0) ctx.fillRect(x + bw * .45, top - height * .045, bw * .06, height * .06);
      ctx.fillStyle = colours[4];
      ctx.globalAlpha = .7;
      for (let row = 0; row < 5; row++) {
        if ((building + row) % 3) ctx.fillRect(x + bw * .22, top + height * (.025 + row * .035), bw * .22, height * .01);
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = colours[3];
    ctx.fillRect(0, horizon, width, height - horizon);
    ctx.strokeStyle = colours[1];
    ctx.lineWidth = Math.max(1, unit * .008);
    for (let lane = -3; lane <= 3; lane++) {
      ctx.beginPath();
      ctx.moveTo(width * .5 + lane * width * .03, horizon);
      ctx.lineTo(width * .5 + lane * width * .35, height);
      ctx.stroke();
    }
    drawPalm(ctx, width * .09, height * .92, height * .7, .15);
    drawPalm(ctx, width * .92, height, height * .83, -.12);
  }

  function paintPanel(ctx, width, height, index) {
    const panel = state.panels[index];
    if (panel.photo === null) return drawCity(ctx, width, height, index);
    const image = state.photos[panel.photo].bitmap;
    const m = cropMetrics(image, panel, width, height);
    ctx.drawImage(image, -m.excessX / 2 + panel.x * m.excessX / 2,
      -m.excessY / 2 + panel.y * m.excessY / 2, m.drawWidth, m.drawHeight);
    applyTreatment(ctx, width, height);
  }

  // LETTERING — heavy system display type with outlines and offset shadows.
  function fitText(ctx, text, maximum, available) {
    let size = maximum;
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    while (ctx.measureText(text).width > available && size > 5) {
      size -= 1;
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    }
    return size;
  }

  function drawLettering(ctx, width, height, layout) {
    const unit = Math.min(width, height);
    const left = width * .045;
    const baseline = height * .72;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const titleWidth = width * (layout === 'landscape' ? .77 : .91);
    const lines = layout === 'landscape' ? ['CITY AFTERGLOW'] : ['CITY', 'AFTERGLOW'];
    const size = fitText(ctx, lines[lines.length - 1], unit * .17, titleWidth);
    lines.forEach((text, index) => {
      const y = baseline - (lines.length - 1 - index) * size * .87;
      ctx.lineWidth = unit * .018;
      ctx.strokeStyle = '#171322';
      ctx.fillStyle = palette[state.grade][1];
      ctx.strokeText(text, left + unit * .007, y + unit * .009);
      ctx.fillText(text, left + unit * .007, y + unit * .009);
      ctx.lineWidth = unit * .01;
      ctx.strokeText(text, left, y);
      ctx.fillStyle = '#fff1d8';
      ctx.fillText(text, left, y);
    });
    const caption = state.caption.trim().toUpperCase();
    fitText(ctx, caption, unit * .032, width * .87);
    ctx.fillStyle = '#fff1d8';
    ctx.shadowColor = '#171322';
    ctx.shadowBlur = unit * .009;
    ctx.fillText(caption, left, height * .955);
    ctx.shadowBlur = 0;
    ctx.font = `700 ${unit * .012}px Arial, sans-serif`;
    ctx.fillText('SUNSET CIRCUIT  /  AN ORIGINAL CITY STORY', left, height * .046);
    ctx.restore();
  }

  function renderCover(ctx, width, height, layout, editing = false) {
    ctx.save();
    ctx.fillStyle = '#171322';
    ctx.fillRect(0, 0, width, height);
    panelGeometry(layout).forEach(([x, y, w, h], index) => {
      ctx.save();
      ctx.translate(x * width, y * height);
      ctx.beginPath();
      ctx.rect(0, 0, w * width, h * height);
      ctx.clip();
      if (index < 3) paintPanel(ctx, w * width, h * height, index);
      else drawCity(ctx, w * width, h * height, 1);
      ctx.restore();
    });
    drawLettering(ctx, width, height, layout);
    if (editing && state.photos.length) {
      const [x, y, w, h] = panelGeometry(layout)[state.selected];
      ctx.strokeStyle = '#fff1d8aa';
      ctx.lineWidth = Math.min(width, height) * .002;
      ctx.strokeRect(x * width + 2, y * height + 2, w * width - 4, h * height - 4);
    }
    ctx.restore();
  }

  function setLayout(layout) {
    state.layout = layout;
    const [width, height] = dimensions[layout];
    canvas.width = Math.round(width * Math.min(1, 1080 / Math.max(width, height)));
    canvas.height = Math.round(height * Math.min(1, 1080 / Math.max(width, height)));
    $('layoutReadout').textContent = `${layout.toUpperCase()} / FOUR PANELS`;
    syncControls();
    schedule();
  }
  document.querySelectorAll('[data-layout]').forEach(button => {
    button.addEventListener('click', () => setLayout(button.dataset.layout));
  });
  $('captionInput').addEventListener('input', event => {
    state.caption = event.target.value;
    syncControls();
    schedule();
  });

  // PNG EXPORTS — compose full-resolution pixels, never enlarge the preview.
  async function exportPng(layout) {
    if (state.exporting) return;
    state.exporting = true;
    document.querySelectorAll('[data-size]').forEach(button => { button.disabled = true; });
    try {
      const result = document.createElement('canvas');
      [result.width, result.height] = dimensions[layout];
      renderCover(result.getContext('2d'), result.width, result.height, layout);
      const blob = await new Promise(resolve => result.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG encoder returned no image');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sunset-circuit-${layout}-${result.width}x${result.height}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status(`PNG ready: ${result.width} × ${result.height}. Check your downloads.`);
    } catch (error) {
      status(`Export failed: ${error.message}. Try a smaller format.`);
    } finally {
      state.exporting = false;
      document.querySelectorAll('[data-size]').forEach(button => { button.disabled = false; });
    }
  }
  document.querySelectorAll('[data-size]').forEach(button => {
    button.addEventListener('click', () => exportPng(button.dataset.size));
  });
  $('resetButton').addEventListener('click', () => {
    state.epoch++;
    state.photos = [];
    state.panels = names.map(freshCrop);
    state.selected = 0;
    state.grade = 'sunset';
    state.caption = 'THE CITY NEVER COOLS';
    $('captionInput').value = state.caption;
    drag = null;
    rebuildTray();
    setLayout('portrait');
    status('Studio reset. Your local photos have been released.');
  });
  setLayout('portrait');
})();
