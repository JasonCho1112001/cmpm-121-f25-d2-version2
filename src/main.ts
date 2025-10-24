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

//Drawing with Mouse (store strokes and use an event to trigger redraw)
type Point = { x: number; y: number };
const strokes: Point[][] = [];

const ctx = canvas.getContext("2d")!;
const cursor = { active: false, x: 0, y: 0 };

// Redraw observer: clears canvas and redraws all strokes
canvas.addEventListener("drawing-changed", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  }
});

// Mouse handlers push points into the current stroke and dispatch changes
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  const pt: Point = { x: e.offsetX, y: e.offsetY };
  strokes.push([pt]);
  cursor.x = pt.x;
  cursor.y = pt.y;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

canvas.addEventListener("mousemove", (e) => {
  if (!cursor.active) return;
  const pt: Point = { x: e.offsetX, y: e.offsetY };
  const current = strokes[strokes.length - 1];
  if (current) {
    current.push(pt);
    cursor.x = pt.x;
    cursor.y = pt.y;
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

canvas.addEventListener("mouseup", (_e) => {
  cursor.active = false;
  // Optionally dispatch to ensure final state is drawn
  canvas.dispatchEvent(new Event("drawing-changed"));
});

const clearButton = document.createElement("button");
clearButton.type = "button";
clearButton.className = "clear-button";
clearButton.textContent = "Clear";
// Add the clear button next to the canvas inside the same row
canvasRow.appendChild(clearButton);

clearButton.addEventListener("click", () => {
  strokes.length = 0;
  canvas.dispatchEvent(new Event("drawing-changed"));
});
