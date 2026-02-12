import type { Shape } from "@smalldraw/core";
import type { StampShape } from "./stampShape";

export function renderStamp(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const stamp = shape as StampShape;
  if (stamp.geometry.type !== "stamp") {
    return;
  }

  const stroke = stamp.style.stroke;
  if (!stroke || stroke.color === "transparent" || stroke.size <= 0) {
    return;
  }

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.compositeOp) {
    ctx.globalCompositeOperation = stroke.compositeOp;
  }

  for (const path of stamp.geometry.paths) {
    if (path.commands.length === 0) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(path.start[0], path.start[1]);
    for (const command of path.commands) {
      if (command.kind === "line") {
        ctx.lineTo(command.to[0], command.to[1]);
        continue;
      }
      ctx.quadraticCurveTo(
        command.control[0],
        command.control[1],
        command.to[0],
        command.to[1],
      );
    }
    ctx.stroke();
  }
}
