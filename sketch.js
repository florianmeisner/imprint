// sketch.js (komplett) — Image Zeile ist jetzt identisch aufgebaut wie Font-Zeile

// --- UI State ---
let inputText, squeezeSlider, sizeSlider, weightSlider;
let outlineMode = false;
const LINE_HEIGHT_MULTIPLIER = 1.014;
let highlightMode = false;
let previewImage = null;
let uploadedImageData = null;
let isImagePreviewActive = false;
let pendingImageAdvance = false;
let canvas;

// --- Controls ---
let toggleOutlineButton, toggleHighlightButton, toggleNoneButton;
let fontSelect, colorSlider;
let exportButton;
let imageUploadInput;

let currentFont = "Arial";
let defaultTextValue = "";
let hasUserTyped = false;
const MIN_CANVAS_WIDTH_VW = 5;
const CANVAS_SIDE_PADDING = 80;
const MAX_CANVAS_VW = 70;
const CANVAS_HEIGHT_PADDING = 60;
const MIN_CANVAS_HEIGHT_VH = 10;
const MAX_CANVAS_HEIGHT_VH = 70;

const COLOR_STOPS = [
  { pos: 0.0, rgb: [0, 0, 0] },
  { pos: 0.14, rgb: [255, 0, 0] },
  { pos: 0.28, rgb: [255, 255, 0] },
  { pos: 0.42, rgb: [0, 255, 0] },
  { pos: 0.56, rgb: [0, 255, 255] },
  { pos: 0.70, rgb: [0, 0, 255] },
  { pos: 0.84, rgb: [255, 0, 255] },
  { pos: 1.0, rgb: [255, 255, 255] },
];

function addLabeledControl(labelText, control, rowClass) {
  const row = createDiv();
  row.addClass("control-row");
  if (rowClass) row.addClass(rowClass);
  row.parent("controls");

  const label = createDiv(labelText);
  label.addClass("control-label");
  label.parent(row);

  control.parent(row);
  return control;
}

function setButtonActive(button, isActive) {
  if (isActive) button.addClass("is-active");
  else button.removeClass("is-active");
}

function getColorFromSlider(value) {
  const t = value / 1000;
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const start = COLOR_STOPS[i];
    const end = COLOR_STOPS[i + 1];
    if (t >= start.pos && t <= end.pos) {
      const localT = (t - start.pos) / (end.pos - start.pos);
      const r = lerp(start.rgb[0], end.rgb[0], localT);
      const g = lerp(start.rgb[1], end.rgb[1], localT);
      const b = lerp(start.rgb[2], end.rgb[2], localT);
      return color(r, g, b);
    }
  }
  return color(0, 0, 0);
}

/* ✅ setzt --thumb-h pro Slider auf die echte Row-Höhe */
function syncSliderThumbHeights() {
  const sliders = document.querySelectorAll('#controls input[type="range"]');
  sliders.forEach(slider => {
    const row = slider.closest('.control-row');
    if (!row) return;

    const h = row.clientHeight;               // echte Innenhöhe der Row
    slider.style.setProperty('--thumb-h', `${h}px`);
    slider.style.setProperty('--range-h', `${h}px`);
  });
}

function setup() {
  canvas = createCanvas(800, 400);
  canvas.parent("canvas-wrapper");
  pixelDensity(1);

  textAlign(LEFT, CENTER);
  textFont(currentFont);

  defaultTextValue = getDefaultDateText();

  // Textinput (multiline)
  inputText = createElement("textarea", defaultTextValue);
  inputText.attribute("rows", "3");
  inputText.addClass("text-input");
  addLabeledControl("Text input", inputText, "text-row");

  const storedText = sessionStorage.getItem("stufe1Text");
  if (storedText !== null) {
    inputText.value(storedText);
    hasUserTyped = true;
  }

  inputText.elt.addEventListener("focus", () => {
    if (!hasUserTyped && inputText.value() === defaultTextValue) {
      inputText.value("");
      hasUserTyped = true;
      updateCanvasWidth();
    }
  });

  inputText.input(() => {
    if (!hasUserTyped) hasUserTyped = true;
    updateCanvasWidth();
  });

  // ✅ FONT SELECT (unchanged)
  const fontControl = createDiv();
  fontControl.addClass("select-control");

  const fontButton = createButton("Select");
  fontButton.addClass("select-trigger");
  fontButton.parent(fontControl);

  fontSelect = createSelect();
  fontSelect.addClass("font-select");
  fontSelect.option("Arial");
  fontSelect.option("Helvetica");
  fontSelect.option("Times New Roman");
  fontSelect.option("Menlo");

  fontSelect.selected("Arial");
  fontSelect.changed(() => {
    currentFont = fontSelect.value();
    textFont(currentFont);
    updateCanvasWidth();
  });
  fontSelect.parent(fontControl);

  addLabeledControl("Font", fontControl, "");

  // Sliders
  weightSlider = createSlider(100, 900, 300, 1);
  addLabeledControl("Weight", weightSlider);

  sizeSlider = createSlider(16, 200, 64, 1);
  addLabeledControl("Size", sizeSlider);

  squeezeSlider = createSlider(0.1, 2, 1, 0.01);
  addLabeledControl("Squeeze", squeezeSlider);

  sizeSlider.input(() => {
    updateCanvasWidth();
    syncSliderThumbHeights();
  });

  squeezeSlider.input(() => {
    updateCanvasWidth();
    syncSliderThumbHeights();
  });

  // Color
  colorSlider = createSlider(0, 1000, 0, 1);
  colorSlider.addClass("color-slider");
  addLabeledControl("Color", colorSlider);

  // Buttons
  const styleGroup = createDiv();
  styleGroup.addClass("style-buttons");

  function setExclusiveStyle(activeButton) {
    outlineMode = activeButton === toggleOutlineButton;
    highlightMode = activeButton === toggleHighlightButton;

    setButtonActive(toggleOutlineButton, outlineMode);
    setButtonActive(toggleHighlightButton, highlightMode);
    setButtonActive(toggleNoneButton, activeButton === toggleNoneButton);

    syncSliderThumbHeights();
  }

  toggleNoneButton = createButton("None");
  toggleNoneButton.parent(styleGroup);
  toggleNoneButton.mousePressed(() => setExclusiveStyle(toggleNoneButton));

  toggleOutlineButton = createButton("Outline");
  toggleOutlineButton.parent(styleGroup);
  toggleOutlineButton.mousePressed(() => setExclusiveStyle(toggleOutlineButton));

  toggleHighlightButton = createButton("Lable");
  toggleHighlightButton.parent(styleGroup);
  toggleHighlightButton.mousePressed(() => setExclusiveStyle(toggleHighlightButton));

  setExclusiveStyle(toggleNoneButton);
  addLabeledControl("Style", styleGroup, "style-row");

  // ✅ IMAGE UPLOAD — SAME STRUCTURE AS FONT ROW
  const imageControl = createDiv();
  imageControl.addClass("select-control");

  const imageButton = createButton("Upload");
  imageButton.addClass("select-trigger");
  imageButton.parent(imageControl);

  // Use the SAME overlay class as font-select so CSS positioning/hover is identical
  imageUploadInput = createFileInput(handleImageUpload);
  imageUploadInput.addClass("font-select");   // <- identical overlay behavior
  imageUploadInput.addClass("upload-input");  // <- just a small reset
  imageUploadInput.attribute("accept", "image/*");
  imageUploadInput.parent(imageControl);

  addLabeledControl("Image", imageControl, "");

  // Export
  exportButton = createButton("-> send to printer <-");
  const exportRow = createDiv();
  exportRow.addClass("control-row");
  exportRow.addClass("export-row");
  exportRow.parent("controls");
  exportButton.parent(exportRow);
  exportButton.mousePressed(exportPNGAndGo);

  updateCanvasWidth();
  syncCanvasWrapper();

  // ✅ wichtig: nachdem alle Sliders im DOM sind
  syncSliderThumbHeights();
  setTimeout(syncSliderThumbHeights, 0);
}

function getEffectiveText() {
  const txt = inputText ? inputText.value() : "";
  return txt && txt.length ? txt : " ";
}

function updateCanvasWidth() {
  if (!inputText || !sizeSlider || !squeezeSlider) return;
  const txt = getEffectiveText();
  const lines = txt.split("\n");
  const fontSize = sizeSlider.value();
  const squeeze = squeezeSlider.value();
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;

  textSize(fontSize);
  textFont(currentFont);
  textLeading(lineHeight);

  const baseWidth = Math.max(
    0,
    ...lines.map((line) => textWidth(line))
  );
  const displayWidth = baseWidth * squeeze;
  const maxWidth = Math.floor(window.innerWidth * (MAX_CANVAS_VW / 100));
  const minWidth = Math.floor(window.innerWidth * (MIN_CANVAS_WIDTH_VW / 100));
  const nextWidth = Math.min(
    maxWidth,
    Math.max(minWidth, Math.ceil(displayWidth + CANVAS_SIDE_PADDING))
  );

  const displayHeight = Math.ceil(lines.length * lineHeight);
  const maxHeight = Math.floor(window.innerHeight * (MAX_CANVAS_HEIGHT_VH / 100));
  const minHeight = Math.floor(window.innerHeight * (MIN_CANVAS_HEIGHT_VH / 100));
  const nextHeight = Math.min(
    maxHeight,
    Math.max(minHeight, Math.ceil(displayHeight + CANVAS_HEIGHT_PADDING))
  );

  resizeCanvas(nextWidth, nextHeight);
  syncCanvasWrapper();
}

function windowResized() {
  updateCanvasWidth();
  syncSliderThumbHeights();
}

function syncCanvasWrapper() {
  const wrapper = document.getElementById("canvas-wrapper");
  if (!wrapper) return;
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
}

function draw() {
  clear();

  if (isImagePreviewActive && previewImage) {
    drawImagePreview();
    if (pendingImageAdvance) {
      pendingImageAdvance = false;
      setTimeout(() => {
        storeLabelHeight();
        sessionStorage.setItem("stufe1PNG", uploadedImageData);
        window.location.href = "page3.html";
      }, 150);
    }
    return;
  }

  let txt = getEffectiveText();
  const lines = txt.split("\n");
  let squeeze = squeezeSlider.value();
  let fontSize = sizeSlider.value();
  let mainColor = getColorFromSlider(colorSlider.value());
  let fontWeight = weightSlider.value();
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;

  textSize(fontSize);
  textFont(currentFont);
  textLeading(lineHeight);
  drawingContext.font = `${fontWeight} ${fontSize}px ${currentFont}`;

  let baseWidth = Math.max(
    0,
    ...lines.map((line) => textWidth(line))
  );
  let displayWidth = baseWidth * squeeze;
  let displayHeight = lines.length * lineHeight;

  push();
  translate(width / 2, height / 2);
  scale(squeeze, 1);

  const textX = -baseWidth / 2;

  if (highlightMode) {
    push();
    scale(1 / squeeze, 1);
    fill(mainColor);
    noStroke();

    let padX = 20;
    let padY = 10;

    rect(
      -displayWidth / 2 - padX,
      -displayHeight / 2 - padY / 2,
      displayWidth + padX * 2,
      displayHeight + padY
    );
    pop();
  }

  if (highlightMode) {
    fill(255);
    noStroke();
    text(txt, textX, 0);
  } else if (outlineMode) {
    noFill();
    stroke(mainColor);
    strokeWeight(2);
    text(txt, textX, 0);
  } else {
    fill(mainColor);
    noStroke();
    text(txt, textX, 0);
  }

  pop();
}

function handleImageUpload(file) {
  if (!file || file.type !== "image") return;
  uploadedImageData = file.data;
  loadImage(file.data, (loadedImage) => {
    previewImage = loadedImage;
    isImagePreviewActive = true;
    pendingImageAdvance = true;
  });
}

function drawImagePreview() {
  const scaleFactor = min(width / previewImage.width, height / previewImage.height);
  const drawWidth = previewImage.width * scaleFactor;
  const drawHeight = previewImage.height * scaleFactor;
  image(
    previewImage,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function storeLabelHeight() {
  let labelHeight = null;
  let imageHeight = null;

  if (isImagePreviewActive && previewImage) {
    labelHeight = Math.max(1, previewImage.height);
    imageHeight = Math.max(1, previewImage.height);
  } else if (sizeSlider) {
    const fontSize = sizeSlider.value();
    const lineCount = inputText ? inputText.value().split("\n").length : 1;
    labelHeight = Math.max(1, fontSize * LINE_HEIGHT_MULTIPLIER * lineCount);
  }

  const canvasEl = document.querySelector("canvas");
  if (canvasEl && !imageHeight) {
    imageHeight = Math.max(1, canvasEl.height);
  }

  if (labelHeight) sessionStorage.setItem("labelHeight", String(labelHeight));
  if (imageHeight) sessionStorage.setItem("labelImageHeight", String(imageHeight));
}

function storeInputText() {
  if (!inputText) return;
  sessionStorage.setItem("stufe1Text", inputText.value());
}

function getDefaultDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function exportPNGAndGo() {
  let canvas = document.querySelector("canvas");
  let imageData = canvas.toDataURL("image/png");

  storeInputText();
  storeLabelHeight();
  sessionStorage.setItem("stufe1PNG", imageData);
  window.location.href = "page3.html";
}
