import { TILE_SIZE } from "./constants";
import type { TileCoord, TileProvider } from "./types";

export interface DomTileProviderOptions {
  tileSize?: number;
  className?: string;
  getPixelRatio?: () => number;
  getTileIdentity?: () => string;
}

export function createDomTileProvider(
  container: HTMLElement,
  options: DomTileProviderOptions = {},
): TileProvider<HTMLCanvasElement> {
  const tileSize = options.tileSize ?? TILE_SIZE;
  const className = options.className ?? "smalldraw-tile";
  const tiles = new Map<string, HTMLCanvasElement>();
  const canvasKeys = new WeakMap<HTMLCanvasElement, string>();
  const getPixelRatio = options.getPixelRatio ?? (() => 1);
  const getTileIdentity = options.getTileIdentity ?? (() => "default");

  container.style.position = container.style.position || "relative";

  return {
    getTileCanvas: (coord) => {
      const key = tileKey(coord, getTileIdentity());
      const existing = tiles.get(key);
      if (existing) {
        return existing;
      }
      const pixelRatio = normalizePixelRatio(getPixelRatio());
      const backingSize = Math.max(1, Math.round(tileSize * pixelRatio));
      const canvas = document.createElement("canvas");
      canvas.width = backingSize;
      canvas.height = backingSize;
      canvas.className = className;
      canvas.style.position = "absolute";
      canvas.style.left = `${coord.x * tileSize}px`;
      canvas.style.top = `${coord.y * tileSize}px`;
      canvas.style.width = `${tileSize}px`;
      canvas.style.height = `${tileSize}px`;
      container.appendChild(canvas);
      tiles.set(key, canvas);
      canvasKeys.set(canvas, key);
      return canvas;
    },
    releaseTileCanvas: (coord, canvas) => {
      const key = canvasKeys.get(canvas) ?? tileKey(coord, getTileIdentity());
      if (tiles.get(key) !== canvas) return;
      tiles.delete(key);
      canvas.remove();
    },
  };
}

export interface DomLayerController {
  setMode(mode: "tiles" | "hot"): void;
}

export function createDomLayerController(
  tileLayer: HTMLElement,
  hotLayer: HTMLElement,
): DomLayerController {
  const apply = (mode: "tiles" | "hot") => {
    if (mode === "hot") {
      tileLayer.style.visibility = "hidden";
      hotLayer.style.visibility = "";
      return;
    }
    tileLayer.style.visibility = "";
    hotLayer.style.visibility = "hidden";
  };
  apply("tiles");
  return {
    setMode: apply,
  };
}

function tileKey(coord: TileCoord, identity: string): string {
  return `${identity}|${coord.x},${coord.y}`;
}

function normalizePixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}
