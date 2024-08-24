import { getTexture, loadRenderTexture } from "ridder";

export function repeat(x: number, callback: (x: number) => void) {
  for (let i = 0; i < x; i++) {
    callback(i);
  }
}

export function loadOutlineTexture(id: string, ref: string, mode: "circle" | "square", color = "white") {
  const texture = getTexture(ref);
  loadRenderTexture(id, texture.width, texture.height, (ctx, w, h) => {
    ctx.drawImage(texture, 0, -1);
    ctx.drawImage(texture, 1, 0);
    ctx.drawImage(texture, 0, 1);
    ctx.drawImage(texture, -1, 0);
    if (mode === "square") {
      ctx.drawImage(texture, 1, -1);
      ctx.drawImage(texture, 1, 1);
      ctx.drawImage(texture, -1, 1);
      ctx.drawImage(texture, -1, -1);
    }
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(texture, 0, 0);
  });
}

export function loadFlashTexture(id: string, ref: string, color = "white") {
  const texture = getTexture(ref);
  loadRenderTexture(id, texture.width, texture.height, (ctx, w, h) => {
    ctx.drawImage(texture, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  });
}
