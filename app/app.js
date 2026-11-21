(() => {
  "use strict";

  // Sunset Circuit keeps every selected image in this browser tab.
  const MAX_PHOTOS = 8;
  const PANEL_NAMES = ["HERO", "UPPER CUT", "SIDE STORY", "CITY STRIP"];
  const LAYOUTS = {
    portrait: { width: 900, height: 1125, label: "Portrait" },
    square: { width: 900, height: 900, label: "Square" },
    landscape: { width: 1200, height: 675, label: "Wide" }
  };
  const PANELS = {
    portrait: [
      { x: .045, y: .045, w: .62, h: .60 },
      { x: .685, y: .045, w: .27, h: .285 },
      { x: .685, y: .365, w: .27, h: .28 },
      { x: .045, y: .685, w: .91, h: .27 }
    ],
    square: [
      { x: .045, y: .045, w: .62, h: .545 },
      { x: .685, y: .045, w: .27, h: .255 },
      { x: .685, y: .335, w: .27, h: .255 },
      { x: .045, y: .625, w: .91, h: .33 }
    ],
    landscape: [
      { x: .045, y: .055, w: .55, h: .67 },
      { x: .61, y: .055, w: .345, h: .30 },
      { x: .61, y: .39, w: .345, h: .335 },
      { x: .045, y: .765, w: .91, h: .19 }
    ]
  };
  const GRADES = {
    sunset: { top: "rgba(255, 163, 92, .20)", bottom: "rgba(157, 64, 125, .34)", tint: "#ef795c" },
    neon: { top: "rgba(242, 50, 149, .22)", bottom: "rgba(21, 176, 205, .30)", tint: "#cb48b8" },
    mono: { top: "rgba(226, 225, 229, .08)", bottom: "rgba(30, 34, 50, .33)", tint: "#a6a4b0" }
  };
  const TONES = {
    sunset: ["#ffe18e", "#fa8777", "#a859a0"],
    neon: ["#ff6cb7", "#cb68eb", "#69e9e4"],
    mono: ["#fff8ef", "#c8c5cc", "#777985"]
  };
  const els = {
    canvas: document.getElementById("coverCanvas"),
    dropZone: document.getElementById("dropZone"),
    dropHint: document.getElementById("dropHint"),
    photoInput: document.getElementById("photoInput"),
    photoCount: document.getElementById("photoCount"),
    photoTray: document.getElementById("photoTray"),
    panelPicker: document.getElementById("panelPicker"),
    zoom: document.getElementById("zoomSlider"),
    zoomReadout: document.getElementById("zoomReadout"),
    layoutReadout: document.getElementById("layoutReadout"),
    title: document.getElementById("titleInput"),
    caption: document.getElementById("captionInput"),
    exportStatus: document.getElementById("exportStatus"),
    reset: document.getElementById("resetButton")
  };
  const ctx = els.canvas.getContext("2d", { alpha: false });
  const state = {
    photos: [],
    layout: "portrait",
    grade: "sunset",
    tone: "sunset",
    activePanel: 0,
    panels: PANEL_NAMES.map(() => ({ photoIndex: 0, zoom: 1, panX: 0, panY: 0 })),
    pointer: null,
    dragDepth: 0
  };

  // Layout, controls and canvas are driven from one small state object.
  function currentPanel() {
    return state.panels[state.activePanel];
  }

  function activePhotoIndex() {
    return currentPanel().photoIndex;
  }

  function selectedPhoto() {
    return state.photos[activePhotoIndex()] || null;
  }

  function frameSize() {
    return LAYOUTS[state.layout];
  }

  function panelRect(index, width = els.canvas.width, height = els.canvas.height) {
    const unit = PANELS[state.layout][index];
    return { x: unit.x * width, y: unit.y * height, w: unit.w * width, h: unit.h * height };
  }

  function fitCanvasToLayout() {
    const size = frameSize();
    els.canvas.width = size.width;
    els.canvas.height = size.height;
    els.layoutReadout.textContent = size.label + " · four panels";
    drawCover();
  }

  // Photo loading uses object URLs only; no file data leaves the device.
  function loadPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Choose an image file."));
        return;
      }
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ name: file.name, url, image });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("This image could not be opened."));
      };
      image.src = url;
    });
  }

  async function addPhotos(files) {
    const available = Math.max(0, MAX_PHOTOS - state.photos.length);
    const candidates = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, available);
    if (!candidates.length) {
      setStatus(available ? "Choose JPG, PNG, or WebP images." : "The photo tray is full (8 images).", false);
      return;
    }
    const results = await Promise.allSettled(candidates.map(loadPhoto));
    for (const result of results) {
      if (result.status === "fulfilled") {
        state.photos.push(result.value);
      } else {
        setStatus(result.reason.message, false);
      }
    }
    if (state.photos.length) {
      state.panels.forEach((panel) => {
        panel.photoIndex = Math.min(panel.photoIndex, state.photos.length - 1);
      });
      if (state.photos.length === candidates.length) setStatus("Photos added. Select a panel, then a thumbnail to assign it.", true);
    }
    renderPhotoTray();
    updatePanelControls();
    drawCover();
  }

  function releasePhotos() {
    for (const photo of state.photos) URL.revokeObjectURL(photo.url);
    state.photos = [];
  }

  function renderPhotoTray() {
    els.photoTray.replaceChildren();
    els.photoCount.textContent = state.photos.length + " / " + MAX_PHOTOS;
    if (!state.photos.length) {
      const empty = document.createElement("span");
      empty.className = "empty-tray";
      empty.textContent = "Your photo tray is empty";
      els.photoTray.append(empty);
      return;
    }
    state.photos.forEach((photo, index) => {
      const button = document.createElement("button");
      const image = document.createElement("img");
      const badge = document.createElement("span");
      button.type = "button";
      button.className = "photo-thumb";
      button.classList.toggle("is-active", index === activePhotoIndex());
      button.title = "Assign " + photo.name + " to " + PANEL_NAMES[state.activePanel];
      image.src = photo.url;
      image.alt = "";
      badge.className = "photo-index";
      badge.textContent = String(index + 1).padStart(2, "0");
      button.append(image, badge);
      button.addEventListener("click", () => assignPhoto(index));
      els.photoTray.append(button);
    });
  }

  function renderPanelPicker() {
    els.panelPicker.replaceChildren();
    PANEL_NAMES.forEach((name, index) => {
      const button = document.createElement("button");
      const marker = document.createElement("span");
      button.type = "button";
      button.className = "panel-choice";
      button.classList.toggle("is-active", index === state.activePanel);
      marker.textContent = String(index + 1).padStart(2, "0");
      button.append(marker, document.createTextNode(name));
      button.addEventListener("click", () => selectPanel(index));
      els.panelPicker.append(button);
    });
  }

  function selectPanel(index) {
    state.activePanel = index;
    renderPanelPicker();
    renderPhotoTray();
    updatePanelControls();
    drawCover();
  }

  function assignPhoto(index) {
    if (!state.photos[index]) return;
    currentPanel().photoIndex = index;
    currentPanel().panX = 0;
    currentPanel().panY = 0;
    renderPhotoTray();
    drawCover();
    setStatus(PANEL_NAMES[state.activePanel] + " is using photo " + (index + 1) + ".", true);
  }

  function updatePanelControls() {
    const zoom = currentPanel().zoom;
    els.zoom.value = String(zoom);
    els.zoomReadout.value = zoom.toFixed(2) + "×";
    els.zoomReadout.textContent = els.zoomReadout.value;
  }

  // Panel reframing keeps the crop anchored to the panel currently selected.
  function drawPhotoInPanel(photo, panel, rect, index) {
    const image = photo.image;
    const baseScale = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
    const scale = baseScale * panel.zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const extraX = Math.max(0, drawWidth - rect.w);
    const extraY = Math.max(0, drawHeight - rect.h);
    const x = rect.x + (rect.w - drawWidth) / 2 + panel.panX * extraX;
    const y = rect.y + (rect.h - drawHeight) / 2 + panel.panY * extraY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    const grade = GRADES[state.grade];
    const tint = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    tint.addColorStop(0, grade.top);
    tint.addColorStop(1, grade.bottom);
    ctx.fillStyle = tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    if (index === 3) drawCityOverlay(rect);
    ctx.restore();
  }

  function drawEmptyPanel(rect, index) {
    ctx.save();
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    gradient.addColorStop(0, index % 2 ? "#ed8068" : "#8b4678");
    gradient.addColorStop(.52, "#d35172");
    gradient.addColorStop(1, "#342844");
    ctx.fillStyle = gradient;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    drawCityOverlay(rect);
    ctx.restore();
  }

  // The skyline, striped sun and palms are original canvas shapes.
  function drawCityOverlay(rect) {
    const x = rect.x;
    const y = rect.y;
    const w = rect.w;
    const h = rect.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const sunRadius = Math.min(w, h) * .22;
    const sunX = x + w * .72;
    const sunY = y + h * .44;
    const sun = ctx.createLinearGradient(sunX, sunY - sunRadius, sunX, sunY + sunRadius);
    sun.addColorStop(0, "#ffd27a");
    sun.addColorStop(.7, "#ff8a86");
    sun.addColorStop(1, "#e86c91");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, Math.PI, Math.PI * 2);
    ctx.lineTo(sunX + sunRadius, sunY + sunRadius);
    ctx.lineTo(sunX - sunRadius, sunY + sunRadius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 210, 175, .9)";
    for (let line = 0; line < 5; line++) {
      const stripeY = sunY + sunRadius * (.12 + line * .2);
      ctx.fillRect(sunX - sunRadius, stripeY, sunRadius * 2, Math.max(2, h * .018));
    }
    const ground = y + h * .78;
    ctx.fillStyle = "rgba(27, 22, 41, .72)";
    ctx.beginPath();
    ctx.moveTo(x, ground + h * .05);
    let bx = x;
    let seed = 13 + Math.floor(w + h);
    while (bx < x + w) {
      seed = (seed * 9301 + 49297) % 233280;
      const buildingWidth = w * (.045 + (seed / 233280) * .07);
      seed = (seed * 9301 + 49297) % 233280;
      const buildingHeight = h * (.10 + (seed / 233280) * .25);
      ctx.lineTo(bx, ground - buildingHeight);
      ctx.lineTo(bx + buildingWidth * .82, ground - buildingHeight);
      ctx.lineTo(bx + buildingWidth * .82, ground + h * .1);
      bx += buildingWidth;
    }
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    drawPalm(x + w * .15, y + h * .83, h * .42);
    drawPalm(x + w * .91, y + h * .86, h * .32);
    ctx.restore();
  }

  function drawPalm(x, baseY, size) {
    ctx.save();
    ctx.strokeStyle = "rgba(23, 18, 35, .88)";
    ctx.lineWidth = Math.max(2, size * .055);
    ctx.lineCap = "round";
    const topX = x + size * .12;
    const topY = baseY - size;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + size * .12, baseY - size * .45, topX, topY);
    ctx.stroke();
    ctx.fillStyle = "rgba(23, 18, 35, .9)";
    for (let frond = 0; frond < 7; frond++) {
      const angle = Math.PI * 2 * frond / 7;
      const endX = topX + Math.cos(angle) * size * .42;
      const endY = topY + Math.sin(angle) * size * .22 - size * .04;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(angle) * size * .18, topY - size * .12, endX, endY);
      ctx.lineTo(topX + Math.cos(angle) * size * .2, topY + Math.sin(angle) * size * .08);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBackdrop(width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const colors = state.grade === "neon"
      ? ["#25133f", "#802b68", "#166474"]
      : state.grade === "mono" ? ["#373741", "#77717d", "#292936"] : ["#472b4b", "#d45c73", "#f4a264"];
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(.55, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * .68, height * .32, 2, width * .68, height * .32, width * .72);
    glow.addColorStop(0, "rgba(255, 190, 121, .38)");
    glow.addColorStop(1, "rgba(31, 22, 45, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    drawCityOverlay({ x: 0, y: height * .49, w: width, h: height * .51 });
  }

  // Lettering is drawn with system fonts, layered shadow and custom gradient ink.
  function drawLettering(width, height) {
    const ribbonY = height * (state.layout === "landscape" ? .765 : .685);
    const ribbonH = height - ribbonY;
    const shade = ctx.createLinearGradient(0, ribbonY - height * .08, 0, height);
    shade.addColorStop(0, "rgba(19, 15, 26, 0)");
    shade.addColorStop(.22, "rgba(19, 15, 26, .58)");
    shade.addColorStop(1, "rgba(19, 15, 26, .86)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, ribbonY - height * .08, width, height - ribbonY + height * .08);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const inset = width * .075;
    const title = (els.title.value || "CITY AFTERGLOW").trim().toUpperCase();
    const titleSize = Math.min(width * .106, ribbonH * .33);
    ctx.font = "900 " + titleSize + 'px "Arial Black", Impact, system-ui, sans-serif';
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, titleSize * .035);
    ctx.strokeStyle = "rgba(34, 20, 39, .88)";
    ctx.shadowColor = "rgba(18, 11, 26, .7)";
    ctx.shadowBlur = titleSize * .15;
    ctx.shadowOffsetY = titleSize * .06;
    ctx.strokeText(title, inset, ribbonY + ribbonH * .52, width - inset * 2);
    const tone = TONES[state.tone];
    const lettering = ctx.createLinearGradient(inset, ribbonY, width - inset, ribbonY + ribbonH * .56);
    lettering.addColorStop(0, tone[0]);
    lettering.addColorStop(.58, tone[1]);
    lettering.addColorStop(1, tone[2]);
    ctx.fillStyle = lettering;
    ctx.fillText(title, inset, ribbonY + ribbonH * .52, width - inset * 2);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(255, 244, 231, .94)";
    ctx.font = "700 " + Math.max(11, width * .018) + 'px system-ui, sans-serif';
    ctx.letterSpacing = "0.12em";
    ctx.fillText((els.caption.value || "THE CITY NEVER COOLS").trim().toUpperCase(), inset + 2, ribbonY + ribbonH * .77, width - inset * 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 227, 200, .82)";
    ctx.font = "800 " + Math.max(9, width * .014) + 'px system-ui, sans-serif';
    ctx.fillText("SUNSET CIRCUIT   /   06", width - inset, ribbonY + ribbonH * .95);
    ctx.textAlign = "left";
    ctx.letterSpacing = "0px";
  }

  function drawCover() {
    if (!ctx) return;
    const width = els.canvas.width;
    const height = els.canvas.height;
    drawBackdrop(width, height);
    for (let index = 0; index < PANEL_NAMES.length; index++) {
      const rect = panelRect(index, width, height);
      const panel = state.panels[index];
      const photo = state.photos[panel.photoIndex];
      ctx.save();
      ctx.shadowColor = "rgba(17, 13, 22, .52)";
      ctx.shadowBlur = width * .018;
      ctx.shadowOffsetY = width * .008;
      ctx.fillStyle = "#211a2b";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      if (photo) drawPhotoInPanel(photo, panel, rect, index);
      else drawEmptyPanel(rect, index);
      ctx.save();
      ctx.strokeStyle = index === state.activePanel ? "rgba(255, 211, 151, .95)" : "rgba(255, 236, 222, .72)";
      ctx.lineWidth = index === state.activePanel ? Math.max(2, width * .0032) : Math.max(1, width * .0016);
      ctx.strokeRect(rect.x + .5, rect.y + .5, rect.w - 1, rect.h - 1);
      ctx.restore();
      drawPanelLabel(index, rect);
    }
    drawLettering(width, height);
    drawCornerDetails(width, height);
    els.dropHint.classList.toggle("is-visible", state.photos.length === 0);
  }

  function drawPanelLabel(index, rect) {
    if (rect.w < 140 || rect.h < 80) return;
    ctx.save();
    ctx.font = "800 " + Math.max(9, rect.w * .018) + 'px system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 245, 232, .86)";
    ctx.shadowColor = "#19111d";
    ctx.shadowBlur = 5;
    ctx.fillText(String(index + 1).padStart(2, "0") + "  /  " + PANEL_NAMES[index], rect.x + rect.w * .045, rect.y + rect.h * .91, rect.w * .88);
    ctx.restore();
  }

  function drawCornerDetails(width, height) {
    ctx.save();
    ctx.globalAlpha = .8;
    ctx.fillStyle = "#ffe7c8";
    ctx.font = "800 " + Math.max(9, width * .013) + 'px system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("VICE CITY • FLORIDA", width * .05, height * .032);
    ctx.textAlign = "right";
    ctx.fillText("NIGHT DRIVE EDITION", width * .95, height * .032);
    ctx.restore();
  }

  // Grade and layout buttons update the live artboard immediately.
  function selectGrade(grade) {
    if (!GRADES[grade]) return;
    state.grade = grade;
    document.querySelectorAll("[data-grade]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.grade === grade);
    });
    drawCover();
  }

  function selectTone(tone) {
    if (!TONES[tone]) return;
    state.tone = tone;
    document.querySelectorAll("[data-tone]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tone === tone);
    });
    drawCover();
  }

  function selectLayout(layout) {
    if (!LAYOUTS[layout]) return;
    state.layout = layout;
    document.querySelectorAll("[data-layout]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.layout === layout);
    });
    fitCanvasToLayout();
  }

  function setStatus(message, success) {
    els.exportStatus.textContent = message;
    els.exportStatus.classList.toggle("is-success", Boolean(success));
  }

  // Export uses a fresh full-resolution canvas so preview scaling never reduces detail.
  function exportCover(kind) {
    const sizes = {
      square: [1080, 1080],
      portrait: [1080, 1350],
      landscape: [1920, 1080]
    };
    const dimensions = sizes[kind];
    if (!dimensions) return;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = dimensions[0];
    outputCanvas.height = dimensions[1];
    const outputContext = outputCanvas.getContext("2d");
    const previousCanvas = { width: els.canvas.width, height: els.canvas.height };
    const previousLayout = state.layout;
    const targetLayout = kind;
    const sourcePanels = state.panels.map((panel) => ({ ...panel }));
    state.layout = targetLayout;
    els.canvas.width = dimensions[0];
    els.canvas.height = dimensions[1];
    drawCover();
    outputContext.drawImage(els.canvas, 0, 0);
    state.panels = sourcePanels;
    state.layout = previousLayout;
    els.canvas.width = previousCanvas.width;
    els.canvas.height = previousCanvas.height;
    drawCover();
    outputCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("PNG export could not be created. Please try again.", false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "sunset-circuit-" + kind + "-" + dimensions.join("x") + ".png";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Downloaded " + dimensions[0] + " × " + dimensions[1] + " PNG.", true);
    }, "image/png");
  }

  // Pointer motion shifts the selected crop without changing the other panels.
  function pointerPosition(event) {
    const bounds = els.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * els.canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * els.canvas.height / bounds.height
    };
  }

  function panelAt(point) {
    return PANELS[state.layout].findIndex((unit) => {
      const rect = { x: unit.x * els.canvas.width, y: unit.y * els.canvas.height, w: unit.w * els.canvas.width, h: unit.h * els.canvas.height };
      return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
    });
  }

  function beginReframe(event) {
    if (event.button !== 0) return;
    const point = pointerPosition(event);
    const targetPanel = panelAt(point);
    if (targetPanel < 0) return;
    if (targetPanel !== state.activePanel) selectPanel(targetPanel);
    state.pointer = { id: event.pointerId, point, panel: state.activePanel };
    els.canvas.setPointerCapture(event.pointerId);
  }

  function moveReframe(event) {
    if (!state.pointer || state.pointer.id !== event.pointerId) return;
    const next = pointerPosition(event);
    const rect = panelRect(state.pointer.panel);
    const panel = state.panels[state.pointer.panel];
    const photo = state.photos[panel.photoIndex];
    if (!photo) {
      state.pointer.point = next;
      return;
    }
    const scale = Math.max(rect.w / photo.image.naturalWidth, rect.h / photo.image.naturalHeight) * panel.zoom;
    const overflowX = Math.max(1, photo.image.naturalWidth * scale - rect.w);
    const overflowY = Math.max(1, photo.image.naturalHeight * scale - rect.h);
    panel.panX = clamp(panel.panX + (next.x - state.pointer.point.x) / overflowX, -.5, .5);
    panel.panY = clamp(panel.panY + (next.y - state.pointer.point.y) / overflowY, -.5, .5);
    state.pointer.point = next;
    drawCover();
  }

  function endReframe(event) {
    if (state.pointer && state.pointer.id === event.pointerId) state.pointer = null;
  }

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function resetStudio() {
    releasePhotos();
    state.layout = "portrait";
    state.grade = "sunset";
    state.tone = "sunset";
    state.activePanel = 0;
    state.panels = PANEL_NAMES.map(() => ({ photoIndex: 0, zoom: 1, panX: 0, panY: 0 }));
    els.title.value = "CITY AFTERGLOW";
    els.caption.value = "THE CITY NEVER COOLS";
    els.photoInput.value = "";
    document.querySelectorAll("[data-layout]").forEach((button) => button.classList.toggle("is-active", button.dataset.layout === "portrait"));
    document.querySelectorAll("[data-grade]").forEach((button) => button.classList.toggle("is-active", button.dataset.grade === "sunset"));
    document.querySelectorAll("[data-tone]").forEach((button) => button.classList.toggle("is-active", button.dataset.tone === "sunset"));
    renderPhotoTray();
    renderPanelPicker();
    updatePanelControls();
    fitCanvasToLayout();
    setStatus("Studio reset. Add a photo to start a new cover.", true);
  }

  function bindEvents() {
    els.photoInput.addEventListener("change", (event) => {
      addPhotos(event.target.files);
      event.target.value = "";
    });
    els.dropZone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      state.dragDepth++;
      els.dropHint.classList.add("is-visible");
    });
    els.dropZone.addEventListener("dragover", (event) => event.preventDefault());
    els.dropZone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      state.dragDepth = Math.max(0, state.dragDepth - 1);
      if (!state.dragDepth && state.photos.length) els.dropHint.classList.remove("is-visible");
    });
    els.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      state.dragDepth = 0;
      addPhotos(event.dataTransfer.files);
    });
    els.zoom.addEventListener("input", () => {
      currentPanel().zoom = Number(els.zoom.value);
      updatePanelControls();
      drawCover();
    });
    els.title.addEventListener("input", drawCover);
    els.caption.addEventListener("input", drawCover);
    els.reset.addEventListener("click", resetStudio);
    els.canvas.addEventListener("pointerdown", beginReframe);
    els.canvas.addEventListener("pointermove", moveReframe);
    els.canvas.addEventListener("pointerup", endReframe);
    els.canvas.addEventListener("pointercancel", endReframe);
    document.querySelectorAll("[data-layout]").forEach((button) => button.addEventListener("click", () => selectLayout(button.dataset.layout)));
    document.querySelectorAll("[data-grade]").forEach((button) => button.addEventListener("click", () => selectGrade(button.dataset.grade)));
    document.querySelectorAll("[data-tone]").forEach((button) => button.addEventListener("click", () => selectTone(button.dataset.tone)));
    document.querySelectorAll("[data-size]").forEach((button) => button.addEventListener("click", () => exportCover(button.dataset.size)));
    window.addEventListener("beforeunload", releasePhotos);
  }

  function initialize() {
    bindEvents();
    renderPhotoTray();
    renderPanelPicker();
    updatePanelControls();
    fitCanvasToLayout();
    setStatus("Photos stay in this browser. Choose a panel and reframe the crop.", false);
  }

  initialize();
})();
