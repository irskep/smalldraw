import { TILE_SIZE } from "./constants";
import type { TileCoord, TileProvider } from "./types";

export interface DomTileProviderOptions {
  tileSize?: number;
  className?: string;
}

export function createDomTileProvider(
  container: HTMLElement,
  options: DomTileProviderOptions = {},
): TileProvider<HTMLCanvasElement> {
  const tileSize = options.tileSize ?? TILE_SIZE;
  const className = options.className ?? "smalldraw-tile";
  const tiles = new Map<string, HTMLCanvasElement>();

  container.style.position = container.style.position || "relative";

  return {
    getTileCanvas: (coord) => {
      const key = tileKey(coord);
      const existing = tiles.get(key);
      if (existing) {
        return existing;
      }
      const canvas = document.createElement("canvas");
      canvas.width = tileSize;
      canvas.height = tileSize;
      canvas.className = className;
      canvas.style.position = "absolute";
      canvas.style.left = `${coord.x * tileSize}px`;
      canvas.style.top = `${coord.y * tileSize}px`;
      canvas.style.width = `${tileSize}px`;
      canvas.style.height = `${tileSize}px`;
      container.appendChild(canvas);
      tiles.set(key, canvas);
      return canvas;
    },
    releaseTileCanvas: (coord, canvas) => {
      const key = tileKey(coord);
      if (tiles.get(key) !== canvas) return;
      tiles.delete(key);
      canvas.remove();
    },
  };
}

function tileKey(coord: TileCoord): string {
  return `${coord.x},${coord.y}`;
}
