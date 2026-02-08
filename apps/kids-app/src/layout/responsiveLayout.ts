export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 240;
export const AUTO_HEIGHT_RESERVED = 80;
export const DESKTOP_INSET_X = 24;
export const MOBILE_INSET_Y = 16;
export const MOBILE_PORTRAIT_BREAKPOINT = 700;

const safeAreaInset = (
  side: "top" | "right" | "bottom" | "left",
  fallbackPx: number,
): string => `max(${fallbackPx}px, env(safe-area-inset-${side}))`;

export function normalizePixelRatio(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}

export function resolvePageSize(fallback: { width: number; height: number }): {
  width: number;
  height: number;
} {
  if (typeof window === "undefined") {
    return fallback;
  }
  return {
    width: Math.max(MIN_WIDTH, Math.round(window.innerWidth)),
    height: Math.max(
      MIN_HEIGHT,
      Math.round(window.innerHeight - AUTO_HEIGHT_RESERVED),
    ),
  };
}

export function applyResponsiveLayout(params: {
  viewportHost: HTMLDivElement;
  canvasFrame: HTMLDivElement;
  sceneRoot: HTMLDivElement;
  width: number;
  height: number;
  displayScale: number;
  displayWidth: number;
  displayHeight: number;
}): {
  displayScale: number;
  displayWidth: number;
  displayHeight: number;
} {
  const {
    viewportHost,
    canvasFrame,
    sceneRoot,
    width,
    height,
    displayScale,
    displayWidth,
    displayHeight,
  } = params;

  const hostRect = viewportHost.getBoundingClientRect();
  if (hostRect.width <= 0 || hostRect.height <= 0) {
    return { displayScale, displayWidth, displayHeight };
  }

  const viewportWidth =
    typeof window !== "undefined" && typeof window.innerWidth === "number"
      ? window.innerWidth
      : width;
  const viewportHeight =
    typeof window !== "undefined" && typeof window.innerHeight === "number"
      ? window.innerHeight
      : height;
  const portrait = viewportHeight > viewportWidth;
  const isNarrowPortrait =
    portrait && viewportWidth <= MOBILE_PORTRAIT_BREAKPOINT;
  const insets = {
    x: isNarrowPortrait ? 0 : DESKTOP_INSET_X,
    y: MOBILE_INSET_Y,
  };

  viewportHost.style.paddingTop = safeAreaInset("top", insets.y);
  viewportHost.style.paddingRight = safeAreaInset("right", insets.x);
  viewportHost.style.paddingBottom = safeAreaInset("bottom", insets.y);
  viewportHost.style.paddingLeft = safeAreaInset("left", insets.x);

  const availableWidth = Math.max(1, hostRect.width - insets.x * 2);
  const availableHeight = Math.max(1, hostRect.height - insets.y * 2);
  const nextScale = Math.min(
    1,
    availableWidth / width,
    availableHeight / height,
  );

  let nextDisplayScale = displayScale;
  let nextDisplayWidth = displayWidth;
  let nextDisplayHeight = displayHeight;

  if (nextScale !== displayScale) {
    nextDisplayScale = nextScale;
    sceneRoot.style.transform = `scale(${nextDisplayScale})`;
  }

  const nextWidthPx = Math.max(1, Math.round(width * nextScale));
  const nextHeightPx = Math.max(1, Math.round(height * nextScale));
  if (nextWidthPx !== displayWidth || nextHeightPx !== displayHeight) {
    nextDisplayWidth = nextWidthPx;
    nextDisplayHeight = nextHeightPx;
    canvasFrame.style.width = `${nextDisplayWidth}px`;
    canvasFrame.style.height = `${nextDisplayHeight}px`;
  }

  return {
    displayScale: nextDisplayScale,
    displayWidth: nextDisplayWidth,
    displayHeight: nextDisplayHeight,
  };
}
