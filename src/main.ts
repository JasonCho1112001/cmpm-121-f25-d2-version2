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
document.body.appendChild(canvas);
