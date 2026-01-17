// --- UI State ---
let inputText, squeezeSlider, sizeSlider, weightSlider;
let outlineMode = false;
let highlightMode = false;
let previewImage = null;
let uploadedImageData = null;
let isImagePreviewActive = false;
let pendingImageAdvance = false;

// --- Controls ---
let toggleOutlineButton, toggleHighlightButton, toggleNoneButton;
let fontSelect, colorSlider;
let exportButton;
let imageUploadInput;

let currentFont = "Arial";
let defaultTextValue = "";
let hasUserTyped = false;

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
  if (rowClass) {
    row.addClass(rowClass);
  }
  row.parent("controls");

  const label = createDiv(labelText);
  label.addClass("control-label");
  label.parent(row);

  control.parent(row);
  return control;
}

function setButtonActive(button, isActive) {
  if (isActive) {
    button.addClass("is-active");
  } else {
    button.removeClass("is-active");
  }
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

function setup() {
  let canvas = createCanvas(800, 400);
  canvas.parent("canvas-container");
  pixelDensity(1);

  textAlign(CENTER, CENTER);
  textFont(currentFont);

  defaultTextValue = getDefaultDateText();

  // Textinput
  inputText = createInput(defaultTextValue);
  addLabeledControl("Text input", inputText);
  const storedText = sessionStorage.getItem("stufe1Text");
  if (storedText !== null) {
    inputText.value(storedText);
    hasUserTyped = true;
  }
  inputText.elt.addEventListener("focus", () => {
    if (!hasUserTyped && inputText.value() === defaultTextValue) {
      inputText.value("");
      hasUserTyped = true;
    }
  });
  inputText.input(() => {
    if (!hasUserTyped) {
      hasUserTyped = true;
    }
  });

  // ✅ SCHRIFT-AUSWAHL
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
  });
  fontSelect.parent(fontControl);
  addLabeledControl("Font", fontControl, "font-row");

  // Slider
  weightSlider = createSlider(100, 900, 300, 1);
  addLabeledControl("Weight", weightSlider);
  sizeSlider   = createSlider(16, 200, 64, 1);
  addLabeledControl("Size", sizeSlider);
  squeezeSlider = createSlider(0.1, 2, 1, 0.01);
  addLabeledControl("Squeeze", squeezeSlider);

  // Farbe
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
  }

  toggleNoneButton = createButton("None");
  toggleNoneButton.parent(styleGroup);
  toggleNoneButton.mousePressed(() => {
    setExclusiveStyle(toggleNoneButton);
  });

  toggleOutlineButton = createButton("Outline");
  toggleOutlineButton.parent(styleGroup);
  toggleOutlineButton.mousePressed(() => {
    setExclusiveStyle(toggleOutlineButton);
  });

  toggleHighlightButton = createButton("Marking");
  toggleHighlightButton.parent(styleGroup);
  toggleHighlightButton.mousePressed(() => {
    setExclusiveStyle(toggleHighlightButton);
  });

  setExclusiveStyle(toggleNoneButton);

  addLabeledControl("Style", styleGroup, "style-row");

  // Image upload
  const imageControl = createDiv();
  imageControl.addClass("select-control");
  const imageButton = createButton("Select");
  imageButton.addClass("select-trigger");
  imageButton.parent(imageControl);

  imageUploadInput = createFileInput(handleImageUpload);
  imageUploadInput.addClass("font-select");
  imageUploadInput.attribute("accept", "image/*");
  imageUploadInput.parent(imageControl);
  addLabeledControl("Image", imageControl, "image-row");

  // Export
  exportButton = createButton("-> send to printer <-");
  const exportRow = createDiv();
  exportRow.addClass("control-row");
  exportRow.addClass("export-row");
  exportRow.parent("controls");
  exportButton.parent(exportRow);
  exportButton.mousePressed(exportPNGAndGo);
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

  // Werte aus UI holen
  let txt = inputText.value();
  let squeeze = squeezeSlider.value();
  let fontSize = sizeSlider.value();
  let mainColor = getColorFromSlider(colorSlider.value());
  let fontWeight = weightSlider.value();

  textSize(fontSize);
  textFont(currentFont);
  drawingContext.font = `${fontWeight} ${fontSize}px ${currentFont}`;

  let baseWidth = textWidth(txt);
  let displayWidth = baseWidth * squeeze;
  let displayHeight = fontSize * 1.2;

  push();
  translate(width / 2, height / 2);
  scale(squeeze, 1);

  // === Markierung ===
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

  // === Text ===
  if (highlightMode) {
    fill(255);
    noStroke();
    text(txt, 0, 0);
  }
  else if (outlineMode) {
    noFill();
    stroke(mainColor);
    strokeWeight(2);
    text(txt, 0, 0);
  }
  else {
    fill(mainColor);
    noStroke();
    text(txt, 0, 0);
  }

  // === Unterstreichung ===
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
    labelHeight = Math.max(1, fontSize * 1.2);
  }

  const canvasEl = document.querySelector("canvas");
  if (canvasEl && !imageHeight) {
    imageHeight = Math.max(1, canvasEl.height);
  }

  if (labelHeight) {
    sessionStorage.setItem("labelHeight", String(labelHeight));
  }
  if (imageHeight) {
    sessionStorage.setItem("labelImageHeight", String(imageHeight));
  }
}

function storeInputText() {
  if (!inputText) return;
  const value = inputText.value();
  sessionStorage.setItem("stufe1Text", value);
}

function getDefaultDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ✅ PNG exportieren & zu Stufe 2 wechseln
function exportPNGAndGo() {
  let canvas = document.querySelector("canvas");
  let imageData = canvas.toDataURL("image/png");

  storeInputText();
  storeLabelHeight();
  sessionStorage.setItem("stufe1PNG", imageData);
  window.location.href = "page3.html";
}
