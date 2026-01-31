// --- Persisted assets ---
let img;               // aktueller Stufe-1-Entwurf (PNG aus Stufe 1)
let printedLayer;      // Druckschicht, auf der gestapelt wird

// --- Druck-Parameter (aktive Werte, werden durch Presets gesetzt) ---
let nozzleCount = 40;
let nozzleSpacing = 2;
let jitterStrength = 0.4;

// --- Preset-Konfiguration ---
// Reihenfolge entspricht den Buttons in page3.html (von links nach rechts).
// Hier kannst du Lines (nozzleCount), Nozzles (nozzleSpacing) und Blur (jitterStrength) anpassen.
const PRESET_CONFIG = [
  { label: "Can",       nozzleCount: 45, nozzleSpacing: 6,   jitterStrength: 0 },
  { label: "Cardboard", nozzleCount: 64, nozzleSpacing: 5,   jitterStrength: 0.4 },
  { label: "Fabric",    nozzleCount: 85, nozzleSpacing: 10,   jitterStrength: 0.35 },
  { label: "Stone",     nozzleCount: 50, nozzleSpacing: 9,   jitterStrength: 1 },
  { label: "Wood",      nozzleCount: 95, nozzleSpacing: 5, jitterStrength: 0.4 },
  {
    label: "Fire",
    randomize: true,
    nozzleCountRange: [10, 240],
    nozzleSpacingRange: [0.6, 28],
    jitterStrengthRange: [0.0, 4.0],
  },
];

// --- Canvas/Interaktion ---
let canvas;
let printOffset = 0;   // Bild läuft wie Walze
let savedPrintImg;     // gespeichertes Druckbild aus Session
let isMouseDown = false;
let isHoverPrintEnabled = false;
let lastMouseX = null;
let lastMouseY = null;
let canvasContainer;
let cursorEl;


// PNG aus Stufe 1 laden und bestehende Druckschicht wiederherstellen
function preload() {
  let data = sessionStorage.getItem("stufe1PNG");
  if (data) img = loadImage(data);

  const savedLayerData = sessionStorage.getItem("stufe2PrintedLayer");
  if (savedLayerData) savedPrintImg = loadImage(savedLayerData);
}

function setup() {
  canvasContainer = document.getElementById("canvas-container");
  let w = canvasContainer.clientWidth;
  let h = canvasContainer.clientHeight;

  // Zeichenfläche initialisieren
  canvas = createCanvas(w, h);
  canvas.parent("canvas-container");
  canvas.mousePressed(handleMousePress);
  canvas.mouseReleased(() => isMouseDown = false);
  canvas.doubleClicked(handleCanvasDoubleClick);
  pixelDensity(1);

  // Layer zum Sammeln aller Druckdurchgänge
  printedLayer = createGraphics(width, height);
  printedLayer.pixelDensity(1);
  printedLayer.clear();

  if (savedPrintImg) {
    printedLayer.image(savedPrintImg, 0, 0, width, height);
  }

  if (img) {
    img.loadPixels();
    prewarmImage();
  }

  setupPresets();
  setupButtons();
  setupAutoSave();
  setupCursor();
}

function prewarmImage() {
  const scratch = createGraphics(1, 1);
  scratch.pixelDensity(1);
  scratch.clear();
  scratch.image(img, 0, 0, 1, 1, 0, 0, 1, 1);
}

function draw() {
  clear();
  image(printedLayer, 0, 0);

  if (!img) return;

  // Solange die Maus gedrückt ist, immer weiter drucken
  if (
    isMouseDown &&
    mouseX >= 0 && mouseX <= width &&
    mouseY >= 0 && mouseY <= height
  ) {
    drawInkjetStreifen(mouseX, mouseY);
  }

  if (
    isHoverPrintEnabled &&
    mouseX >= 0 && mouseX <= width &&
    mouseY >= 0 && mouseY <= height &&
    (mouseX !== lastMouseX || mouseY !== lastMouseY)
  ) {
    drawInkjetStreifen(mouseX, mouseY);
  }

  lastMouseX = mouseX;
  lastMouseY = mouseY;
}



// ✅ RICHTIGER DRUCK: BILD LÄUFT, MAUS POSITIONIERT
function drawInkjetStreifen(x, y) {

  let stripWidth = 5;

  // Bildquelle unabhängig vom Canvas
  let imgXStart = printOffset % img.width;

  for (let i = 0; i < nozzleCount; i++) {

    // Düsenabstand in Y, abhängig vom Preset
    let yOffset = (i - nozzleCount / 2) * nozzleSpacing;

    // Kleine zufällige Abweichung (Blur)
    let jitterX = random(-jitterStrength * 4, jitterStrength * 4);
    let jitterY = random(-jitterStrength * 4, jitterStrength * 4);
    const targetY = y + yOffset + jitterY;
    if (targetY < 0 || targetY > height) continue;

    let imgY = int(map(i, 0, nozzleCount, 0, img.height - 1));
    let stripHeight = img.height / nozzleCount;

    // Bildstreifen auf den Druck-Layer stempeln
    printedLayer.image(
      img,

      // ✅ EXAKT AN MAUSPOSITION
      x + jitterX,
      targetY,

      stripWidth,
      stripHeight,

      // ✅ QUELLE AUS DEM BILD (läuft wie eine Walze)
      imgXStart,
      imgY,
      stripWidth,
      stripHeight
    );
  }

  // ✅ Bildrolle weiterschieben
  printOffset += stripWidth;
}



// --- Presets ---
function setupPresets() {
  const presetButtons = Array.from(document.querySelectorAll(".preset-button"));
  if (!presetButtons.length) return;

  // Presets aus der Konfiguration in die Buttons schreiben
  presetButtons.forEach((button, index) => {
    const config = PRESET_CONFIG[index];
    if (!config) return;
    if (config.randomize) {
      button.dataset.randomize = "true";
      button.dataset.nozzleCountMin = config.nozzleCountRange[0];
      button.dataset.nozzleCountMax = config.nozzleCountRange[1];
      button.dataset.nozzleSpacingMin = config.nozzleSpacingRange[0];
      button.dataset.nozzleSpacingMax = config.nozzleSpacingRange[1];
      button.dataset.jitterStrengthMin = config.jitterStrengthRange[0];
      button.dataset.jitterStrengthMax = config.jitterStrengthRange[1];
      return;
    }
    button.dataset.nozzleCount = config.nozzleCount;
    button.dataset.nozzleSpacing = config.nozzleSpacing;
    button.dataset.jitterStrength = config.jitterStrength;
  });

  const applyPreset = (button) => {
    if (button.dataset.randomize === "true") {
      const countMin = parseFloat(button.dataset.nozzleCountMin);
      const countMax = parseFloat(button.dataset.nozzleCountMax);
      const spacingMin = parseFloat(button.dataset.nozzleSpacingMin);
      const spacingMax = parseFloat(button.dataset.nozzleSpacingMax);
      const jitterMin = parseFloat(button.dataset.jitterStrengthMin);
      const jitterMax = parseFloat(button.dataset.jitterStrengthMax);

      nozzleCount = int(random(countMin, countMax));
      nozzleSpacing = float(random(spacingMin, spacingMax));
      jitterStrength = float(random(jitterMin, jitterMax));

      button.dataset.nozzleCount = nozzleCount;
      button.dataset.nozzleSpacing = nozzleSpacing;
      button.dataset.jitterStrength = jitterStrength;
    } else {
    // Aktive Druckwerte setzen (fürs Zeichnen)
    nozzleCount = int(button.dataset.nozzleCount);
    nozzleSpacing = float(button.dataset.nozzleSpacing);
    jitterStrength = float(button.dataset.jitterStrength);
    }

    // UI-Status markieren
    presetButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");

    updateCursorHeightFromPreset();
  };

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => applyPreset(button));
  });

  // Start-Preset (erstes Icon)
  applyPreset(presetButtons[0]);
}


// --- Buttons ---
function setupButtons() {

  // Canvas leeren und Druck-Offset zurücksetzen
  document.getElementById("resetButton").onclick = () => {
    printedLayer.clear();
    printOffset = 0;
    sessionStorage.removeItem("stufe2PrintedLayer");
  };

  // Ergebnis als PNG exportieren
  document.getElementById("exportButton").onclick = () => {
    let temp = createGraphics(width, height);
    temp.pixelDensity(1);
    temp.clear();
    temp.image(printedLayer, 0, 0);
    save(temp, "imprintexport.png");
  };

  // Zurück zu Stufe 1, aber Druckstatus sichern
  document.getElementById("backButton").onclick = () => {
    savePrintedLayer();
    window.location.href = "page2.html";
  };
}

function setupCursor() {
  if (!canvasContainer) return;
  cursorEl = document.getElementById("print-cursor");
  if (!cursorEl) return;
  updateCursorHeightFromPreset();

  const updateCursorPos = (event) => {
    const rect = canvasContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
  };

  canvasContainer.addEventListener("mouseenter", () => {
    cursorEl.classList.add("is-visible");
  });

  canvasContainer.addEventListener("mouseleave", () => {
    cursorEl.classList.remove("is-visible");
  });

  canvasContainer.addEventListener("mousemove", updateCursorPos);

  const buttons = canvasContainer.querySelectorAll("button");
  buttons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      canvasContainer.classList.add("is-button-hover");
    });
    button.addEventListener("mouseleave", () => {
      canvasContainer.classList.remove("is-button-hover");
    });
  });
}

function updateCursorHeightFromPreset() {
  if (!cursorEl) return;
  const labelHeight = parseFloat(sessionStorage.getItem("labelHeight"));
  const storedImageHeight = parseFloat(sessionStorage.getItem("labelImageHeight"));
  const imageHeight = Number.isFinite(storedImageHeight) && storedImageHeight > 0
    ? storedImageHeight
    : (img && img.height ? img.height : null);

  const printerHeight = Math.max(1, nozzleCount * nozzleSpacing);
  let cursorHeight = printerHeight;

  if (Number.isFinite(labelHeight) && labelHeight > 0 && imageHeight) {
    cursorHeight = printerHeight * (labelHeight / imageHeight);
  } else if (Number.isFinite(labelHeight) && labelHeight > 0) {
    cursorHeight = labelHeight;
  }

  cursorHeight = Math.max(1, cursorHeight);
  cursorHeight = Math.min(cursorHeight, height);
  cursorEl.style.setProperty("--cursor-height", `${cursorHeight}px`);
}

// Druckstatus automatisch sichern (auch bei Navigation/Reload)
function setupAutoSave() {
  window.addEventListener("beforeunload", savePrintedLayer);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") savePrintedLayer();
  });
}

// Druckstatus sichern, damit er beim nächsten Besuch noch da ist
function savePrintedLayer() {
  if (!printedLayer) return;
  const dataURL = printedLayer.elt.toDataURL("image/png");
  sessionStorage.setItem("stufe2PrintedLayer", dataURL);
}

// Sofortiger Druck auf den ersten Klick
function handleMousePress() {
  isMouseDown = true;
  if (isHoverPrintEnabled) isHoverPrintEnabled = false;

  if (!img) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  drawInkjetStreifen(mouseX, mouseY);
}

function handleCanvasDoubleClick() {
  isHoverPrintEnabled = true;
  lastMouseX = null;
  lastMouseY = null;
  return false;
}
