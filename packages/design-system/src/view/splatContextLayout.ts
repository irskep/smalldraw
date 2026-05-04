export type SplatContextLayout =
  | "desktop"
  | "mobile-standard"
  | "mobile-landscape-short";

export const SPLAT_CONTEXT_DESKTOP_THRESHOLD_PX = 580;
export const SPLAT_CONTEXT_SHORT_HEIGHT_THRESHOLD_PX = 360;
export const SPLAT_CONTEXT_MOBILE_SHARE_THRESHOLD_PX = 480;

export function resolveSplatContextLayout(
  width: number,
  height: number,
): SplatContextLayout {
  if (
    width >= SPLAT_CONTEXT_DESKTOP_THRESHOLD_PX &&
    height >= SPLAT_CONTEXT_DESKTOP_THRESHOLD_PX
  ) {
    return "desktop";
  }
  if (
    width > height &&
    height < SPLAT_CONTEXT_SHORT_HEIGHT_THRESHOLD_PX
  ) {
    return "mobile-landscape-short";
  }
  return "mobile-standard";
}

export function shouldShowMobileShare(width: number): boolean {
  return width >= SPLAT_CONTEXT_MOBILE_SHARE_THRESHOLD_PX;
}
