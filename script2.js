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
  { label: "Can",       nozzleCount: 45, nozzleSpacing: 10,   jitterStrength: 0 },
  { label: "Cardboard", nozzleCount: 82, nozzleSpacing: 5,   jitterStrength: 0.4 },
  { label: "Fabric",    nozzleCount: 84, nozzleSpacing: 9,   jitterStrength: 0.1 },
  { label: "Stone",     nozzleCount: 114, nozzleSpacing: 9,   jitterStrength: 1 },
  { label: "Wood",      nozzleCount: 150, nozzleSpacing: 10, jitterStrength: 0.2 },
];

// --- Canvas/Interaktion ---
let canvas;
let printOffset = 0;   // Bild läuft wie Walze
let savedPrintImg;     // gespeichertes Druckbild aus Session
let isMouseDown = false;
let isHoverPrintEnabled = false;
let lastMouseX = null;
let lastMouseY = null;


// PNG aus Stufe 1 laden und bestehende Druckschicht wiederherstellen
function preload() {
  let data = sessionStorage.getItem("stufe1PNG");
  if (data) img = loadImage(data);

  const savedLayerData = sessionStorage.getItem("stufe2PrintedLayer");
  if (savedLayerData) savedPrintImg = loadImage(savedLayerData);
}

function setup() {
  const container = document.getElementById("canvas-container");
  let w = container.clientWidth;
  let h = container.clientHeight;

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

  setupPresets();
  setupButtons();
  setupAutoSave();
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

    let imgY = int(map(i, 0, nozzleCount, 0, img.height - 1));
    let stripHeight = img.height / nozzleCount;

    // Bildstreifen auf den Druck-Layer stempeln
    printedLayer.image(
      img,

      // ✅ EXAKT AN MAUSPOSITION
      x + jitterX,
      y + yOffset + jitterY,

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
    button.dataset.nozzleCount = config.nozzleCount;
    button.dataset.nozzleSpacing = config.nozzleSpacing;
    button.dataset.jitterStrength = config.jitterStrength;
  });

  const applyPreset = (button) => {
    // Aktive Druckwerte setzen (fürs Zeichnen)
    nozzleCount = int(button.dataset.nozzleCount);
    nozzleSpacing = float(button.dataset.nozzleSpacing);
    jitterStrength = float(button.dataset.jitterStrength);

    // UI-Status markieren
    presetButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");
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
    save(temp, "druckergebnis.png");
  };

  // Zurück zu Stufe 1, aber Druckstatus sichern
  document.getElementById("backButton").onclick = () => {
    savePrintedLayer();
    window.location.href = "page2.html";
  };
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
