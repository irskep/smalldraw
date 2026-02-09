import type { Box } from "@smalldraw/geometry";
import { getX, getY } from "@smalldraw/geometry";
import { TILE_SIZE } from "./constants";
import type { TileCoord } from "./types";

export function getVisibleTileCoords(
  bounds: Box,
  tileSize: number = TILE_SIZE,
): TileCoord[] {
  const minX = getX(bounds.min);
  const minY = getY(bounds.min);
  const maxX = getX(bounds.max);
  const maxY = getY(bounds.max);
  if (maxX <= minX || maxY <= minY) return [];

  const minTileX = Math.floor(minX / tileSize);
  const minTileY = Math.floor(minY / tileSize);
  const maxTileX = computeMaxTileIndex(maxX, tileSize);
  const maxTileY = computeMaxTileIndex(maxY, tileSize);
  if (maxTileX < minTileX || maxTileY < minTileY) return [];

  const coords: TileCoord[] = [];
  for (let y = minTileY; y <= maxTileY; y += 1) {
    for (let x = minTileX; x <= maxTileX; x += 1) {
      coords.push({ x, y });
    }
  }
  return coords;
}

export function tileKey(coord: TileCoord): string {
  return `${coord.x},${coord.y}`;
}

export function tileKeyToCoord(key: string): TileCoord {
  const [x, y] = key.split(",").map((value) => Number(value));
  return { x, y };
}

function computeMaxTileIndex(max: number, tileSize: number): number {
  const raw = max / tileSize;
  if (Number.isInteger(raw)) {
    return raw - 1;
  }
  return Math.floor(raw);
}
