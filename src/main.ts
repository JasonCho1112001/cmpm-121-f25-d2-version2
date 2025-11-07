import "./style.css";

//Title
const title = document.createElement("h1");
title.textContent = "Draw My Thingie";
title.style.textAlign = "center";
title.style.fontFamily = "Arial, sans-serif";
title.style.marginTop = "20px";
document.body.prepend(title);

//Canvas
const canvas = document.createElement("canvas");
canvas.className = "app-canvas";
canvas.width = 256;
canvas.height = 256;
// Put canvas and controls in a row so the clear button appears next to the canvas
const canvasRow = document.createElement("div");
canvasRow.className = "canvas-row";
canvasRow.appendChild(canvas);
document.body.appendChild(canvasRow);

// Drawing command abstraction
type Point = { x: number; y: number };

interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
  // optional drag method for interactive repositioning
  drag?(x: number, y: number): void;
}

class MarkerLine implements DisplayCommand {
  points: Point[];
  thickness: number;

  constructor(start: Point, thickness = 2) {
    this.points = [start];
    this.thickness = thickness;
  }

  // called while dragging to extend the line
  drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  display(ctx: CanvasRenderingContext2D) {
    if (this.points.length === 0) return;
    ctx.save();
    ctx.lineWidth = this.thickness;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Tool preview abstraction
interface ToolPreview {
  draw(ctx: CanvasRenderingContext2D): void;
}

class CirclePreview implements ToolPreview {
  x: number;
  y: number;
  thickness: number;

  constructor(x: number, y: number, thickness: number) {
    this.x = x;
    this.y = y;
    this.thickness = thickness;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // semi-transparent preview
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    // radius roughly half the marker thickness (scaled for visibility)
    const radius = Math.max(2, this.thickness);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// Sticker preview and command
class StickerPreview implements ToolPreview {
  x: number;
  y: number;
  emoji: string;
  size: number;

  constructor(x: number, y: number, emoji: string, size = 32) {
    this.x = x;
    this.y = y;
    this.emoji = emoji;
    this.size = size;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.emoji) return;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${this.size}px serif`;
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

class StickerCommand implements DisplayCommand {
  x: number;
  y: number;
  emoji: string;
  size: number;

  constructor(start: Point, emoji: string, size = 32) {
    this.x = start.x;
    this.y = start.y;
    this.emoji = emoji;
    this.size = size;
  }

  // reposition the sticker while dragging
  drag(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${this.size}px serif`;
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

// display list and redo stack now hold command objects (any DisplayCommand)
const strokes: DisplayCommand[] = [];
const redoStack: DisplayCommand[] = [];

// current preview (null when none)
let currentPreview: ToolPreview | null = null;

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D rendering context not available");
}
const cursor = { active: false, x: 0, y: 0 };

// Tools state
type ToolKind = "marker" | "sticker";
let currentTool: ToolKind = "marker";
// Marker thickness when using marker tool
let currentThickness = 2;
// Selected sticker emoji when using sticker tool
let selectedSticker: string | null = null;

// Tool buttons
const toolsRow = document.createElement("div");
toolsRow.className = "tools-row";
canvasRow.appendChild(toolsRow);

const thinButton = document.createElement("button");
thinButton.type = "button";
thinButton.className = "tool-button";
thinButton.textContent = "Thin";

const thickButton = document.createElement("button");
thickButton.type = "button";
thickButton.className = "tool-button";
thickButton.textContent = "Thick";

toolsRow.appendChild(thinButton);
toolsRow.appendChild(thickButton);

// Sticker list (data-driven)
const stickers: string[] = ["🍙", "🥟", "🍜"];

// container for sticker buttons
const stickerContainer = document.createElement("div");
stickerContainer.className = "sticker-container";
toolsRow.appendChild(stickerContainer);

// Custom sticker button
const customButton = document.createElement("button");
customButton.type = "button";
customButton.className = "tool-button custom-button";
customButton.textContent = "Custom…";
toolsRow.appendChild(customButton);

// Render sticker buttons from the stickers array
function renderStickerButtons() {
  // clear existing buttons
  stickerContainer.innerHTML = "";
  for (const emoji of stickers) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tool-button sticker-button";
    b.textContent = emoji;
    b.dataset.emoji = emoji;
    b.addEventListener("click", () => {
      currentTool = "sticker";
      selectedSticker = emoji;
      currentPreview = new StickerPreview(
        cursor.x,
        cursor.y,
        selectedSticker,
        36,
      );
      updateToolSelection();
      canvas.dispatchEvent(new Event("tool-moved"));
    });
    stickerContainer.appendChild(b);
  }
}

customButton.addEventListener("click", () => {
  // ask user for custom sticker (emoji or text)
  const text = prompt("Custom sticker text", "🧽");
  if (text && text.trim() !== "") {
    // add to stickers list and re-render buttons
    stickers.push(text);
    renderStickerButtons();
    // select the newly created sticker
    currentTool = "sticker";
    selectedSticker = text;
    currentPreview = new StickerPreview(
      cursor.x,
      cursor.y,
      selectedSticker,
      36,
    );
    updateToolSelection();
    canvas.dispatchEvent(new Event("tool-moved"));
  }
});

// Simple visual feedback for selected tool
function updateToolSelection() {
  thinButton.classList.toggle(
    "selectedTool",
    currentTool === "marker" && currentThickness === 2,
  );
  // thick brush is now twice as thick (4)
  thickButton.classList.toggle(
    "selectedTool",
    currentTool === "marker" && currentThickness === 4,
  );

  // toggle sticker buttons
  const nodes = stickerContainer.querySelectorAll<HTMLButtonElement>(
    ".sticker-button",
  );
  nodes.forEach((btn) => {
    btn.classList.toggle(
      "selectedTool",
      currentTool === "sticker" && btn.dataset.emoji === selectedSticker,
    );
  });

  // custom button isn't a sticker itself, keep it unselected
}
renderStickerButtons();

// ensure thin/thick buttons restore the marker tool and set thickness
thinButton.addEventListener("click", () => {
  currentTool = "marker";
  currentThickness = 2;
  selectedSticker = null;
  currentPreview = new CirclePreview(cursor.x, cursor.y, currentThickness);
  updateToolSelection();
  canvas.dispatchEvent(new Event("tool-moved"));
});

thickButton.addEventListener("click", () => {
  currentTool = "marker";
  // make thick brush exactly twice the thin brush
  currentThickness = 4;
  selectedSticker = null;
  currentPreview = new CirclePreview(cursor.x, cursor.y, currentThickness);
  updateToolSelection();
  canvas.dispatchEvent(new Event("tool-moved"));
});

// Redraw observer: clears canvas and redraws all commands + preview when appropriate
canvas.addEventListener("drawing-changed", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";

  for (const cmd of strokes) {
    cmd.display(ctx);
  }

  // draw the tool preview only when the user is not drawing
  if (!cursor.active && currentPreview) {
    currentPreview.draw(ctx);
  }
});

// when the tool moves, we want to redraw (tool-moved triggers a drawing update)
canvas.addEventListener("tool-moved", () => {
  // reuse the same redraw logic
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Mouse handlers push command objects into the display list and dispatch changes
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  // hide preview while interacting
  currentPreview = null;

  const pt: Point = { x: e.offsetX, y: e.offsetY };

  if (currentTool === "marker") {
    const line = new MarkerLine(pt, currentThickness);
    strokes.push(line);
  } else if (currentTool === "sticker" && selectedSticker) {
    const sticker = new StickerCommand(pt, selectedSticker, 36);
    strokes.push(sticker);
  }

  // starting a new command invalidates the redo stack
  redoStack.length = 0;
  cursor.x = pt.x;
  cursor.y = pt.y;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

canvas.addEventListener("mousemove", (e) => {
  const x = e.offsetX;
  const y = e.offsetY;

  if (cursor.active) {
    const current = strokes[strokes.length - 1];
    if (current && typeof current.drag === "function") {
      current.drag(x, y);
      cursor.x = x;
      cursor.y = y;
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
    return;
  }

  // not drawing: update tool preview and notify listeners
  cursor.x = x;
  cursor.y = y;

  if (currentTool === "marker") {
    currentPreview = new CirclePreview(x, y, currentThickness);
  } else if (currentTool === "sticker" && selectedSticker) {
    currentPreview = new StickerPreview(x, y, selectedSticker, 36);
  } else {
    currentPreview = null;
  }

  canvas.dispatchEvent(new Event("tool-moved"));
});

canvas.addEventListener("mouseup", (_e) => {
  cursor.active = false;
  // show a preview at the last cursor position immediately after finishing a stroke
  if (currentTool === "marker") {
    currentPreview = new CirclePreview(cursor.x, cursor.y, currentThickness);
  } else if (currentTool === "sticker" && selectedSticker) {
    currentPreview = new StickerPreview(
      cursor.x,
      cursor.y,
      selectedSticker,
      36,
    );
  } else {
    currentPreview = null;
  }
  canvas.dispatchEvent(new Event("drawing-changed"));
});

canvas.addEventListener("mouseleave", () => {
  // clear preview when leaving canvas
  currentPreview = null;
  canvas.dispatchEvent(new Event("tool-moved"));
});

const clearButton = document.createElement("button");
clearButton.type = "button";
clearButton.className = "clear-button";
clearButton.textContent = "Clear";
// Add the clear button next to the canvas inside the same row
canvasRow.appendChild(clearButton);

const undoButton = document.createElement("button");
undoButton.type = "button";
undoButton.className = "undo-button";
undoButton.textContent = "Undo";
canvasRow.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.type = "button";
redoButton.className = "redo-button";
redoButton.textContent = "Redo";
canvasRow.appendChild(redoButton);

clearButton.addEventListener("click", () => {
  strokes.length = 0;
  redoStack.length = 0;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

undoButton.addEventListener("click", () => {
  if (strokes.length === 0) return;
  const popped = strokes.pop();
  if (popped) {
    redoStack.push(popped);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

redoButton.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const restored = redoStack.pop();
  if (restored) {
    strokes.push(restored);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});
