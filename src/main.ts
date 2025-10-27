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

// display list and redo stack now hold command objects
const strokes: MarkerLine[] = [];
const redoStack: MarkerLine[] = [];

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D rendering context not available");
}
const cursor = { active: false, x: 0, y: 0 };

// Track current tool (thickness). Default to thin (2).
let currentThickness = 2;

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

// Simple visual feedback for selected tool
function updateToolSelection() {
  thinButton.classList.toggle("selectedTool", currentThickness === 2);
  thickButton.classList.toggle("selectedTool", currentThickness === 8);
}
thinButton.addEventListener("click", () => {
  currentThickness = 2;
  updateToolSelection();
});
thickButton.addEventListener("click", () => {
  currentThickness = 6;
  updateToolSelection();
});
// initialize selection
updateToolSelection();

// Redraw observer: clears canvas and redraws all commands
canvas.addEventListener("drawing-changed", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";

  for (const cmd of strokes) {
    cmd.display(ctx);
  }
});

// Mouse handlers push command objects into the display list and dispatch changes
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  const pt: Point = { x: e.offsetX, y: e.offsetY };
  const line = new MarkerLine(pt, currentThickness);
  strokes.push(line);
  // starting a new stroke invalidates the redo stack
  redoStack.length = 0;
  cursor.x = pt.x;
  cursor.y = pt.y;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

canvas.addEventListener("mousemove", (e) => {
  if (!cursor.active) return;
  const x = e.offsetX;
  const y = e.offsetY;
  const current = strokes[strokes.length - 1];
  if (current) {
    current.drag(x, y);
    cursor.x = x;
    cursor.y = y;
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

canvas.addEventListener("mouseup", (_e) => {
  cursor.active = false;
  canvas.dispatchEvent(new Event("drawing-changed"));
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
