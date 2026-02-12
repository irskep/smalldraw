import type { Shape } from "@smalldraw/core";
import type { RasterFillShape } from "./rasterFillShape";
import { getLoadedRasterImage } from "./rasterImageCache";

export function renderRasterFill(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
): void {
  const rasterFill = shape as RasterFillShape;
  if (rasterFill.geometry.type !== "raster-fill") {
    return;
  }
  const image = getLoadedRasterImage(rasterFill.geometry.src);
  if (!image) {
    return;
  }
  ctx.drawImage(
    image,
    -rasterFill.geometry.width / 2,
    -rasterFill.geometry.height / 2,
    rasterFill.geometry.width,
    rasterFill.geometry.height,
  );
}
