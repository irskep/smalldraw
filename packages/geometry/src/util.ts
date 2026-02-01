import { Vec2, type Vec2Like } from "gl-matrix";
import type { Vec2Tuple } from "./types";

export function allValuesAreFinite(values: number[]) {
  return values.every((n) => Number.isFinite(n));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function toVec2(value: Vec2Like): Vec2 {
  return new Vec2(value[0], value[1]);
}

export function toVec2Like(value: Vec2Like): Vec2Tuple {
  return [value[0], value[1]];
}

export function getX(value: Vec2Like): number {
  return value[0];
}

export function getY(value: Vec2Like): number {
  return value[1];
}
