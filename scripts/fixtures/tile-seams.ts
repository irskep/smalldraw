import { createDomTileProvider } from "../../packages/renderer-raster/src/dom";
import { applyResponsiveLayout } from "../../packages/splat/src/layout/responsiveLayout";

// Use the real tile positioning and scene layout, with uniform paint so every
// internal pixel should match, including where four tiles meet.
const host = document.createElement("div");
host.style.cssText =
  "position:absolute;left:20.25px;top:20.25px;width:631px;height:510px";
const frame = document.createElement("div");
frame.style.position = "relative";
frame.id = "tile-test-frame";
const scene = document.createElement("div");
scene.style.cssText =
  "position:absolute;left:0;top:0;width:1024px;height:768px;overflow:hidden";
frame.append(scene);
host.append(frame);
document.body.append(host);
const provider = createDomTileProvider(scene, {
  getPixelRatio: () => devicePixelRatio,
});
const tiles: HTMLCanvasElement[] = [];
for (let y = 0; y < 3; y++)
  for (let x = 0; x < 4; x++) tiles.push(provider.getTileCanvas({ x, y }));
let layout = { displayScale: 1, displayWidth: 1024, displayHeight: 768 };
Object.assign(window, {
  paintTileFixture(width: number, alpha: number) {
    host.style.width = `${width}px`;
    for (const canvas of tiles) {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(102,194,38,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    layout = applyResponsiveLayout({
      viewportHost: host,
      canvasFrame: frame,
      sceneRoot: scene,
      width: 1024,
      height: 768,
      ...layout,
    });
  },
});
