export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 240;
export const AUTO_HEIGHT_RESERVED = 80;
export const VIEWPORT_PADDING_TOP = 100;
export const VIEWPORT_PADDING_RIGHT = 120;
export const VIEWPORT_PADDING_BOTTOM = 100;
export const VIEWPORT_PADDING_LEFT = 120;

type ViewportPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const safeAreaInset = (
  side: "top" | "right" | "bottom" | "left",
  fallbackPx: number,
): string => `max(${fallbackPx}px, env(safe-area-inset-${side}))`;

const parseCssPixels = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const applyViewportPaddingStyles = (
  viewportHost: HTMLDivElement,
  padding: ViewportPadding,
): void => {
  const top = safeAreaInset("top", padding.top);
  const right = safeAreaInset("right", padding.right);
  const bottom = safeAreaInset("bottom", padding.bottom);
  const left = safeAreaInset("left", padding.left);
  viewportHost.style.setProperty("--kids-inset-top", top);
  viewportHost.style.setProperty("--kids-inset-right", right);
  viewportHost.style.setProperty("--kids-inset-bottom", bottom);
  viewportHost.style.setProperty("--kids-inset-left", left);
  viewportHost.style.paddingTop = top;
  viewportHost.style.paddingRight = right;
  viewportHost.style.paddingBottom = bottom;
  viewportHost.style.paddingLeft = left;
};

const getAppliedViewportPadding = (
  viewportHost: HTMLDivElement,
  fallbackPadding: ViewportPadding,
): ViewportPadding => {
  const styles = window.getComputedStyle(viewportHost);
  return {
    top: parseCssPixels(styles.paddingTop, fallbackPadding.top),
    right: parseCssPixels(styles.paddingRight, fallbackPadding.right),
    bottom: parseCssPixels(styles.paddingBottom, fallbackPadding.bottom),
    left: parseCssPixels(styles.paddingLeft, fallbackPadding.left),
  };
};

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

  const horizontalPadding = VIEWPORT_PADDING_LEFT + VIEWPORT_PADDING_RIGHT;
  const verticalPadding = VIEWPORT_PADDING_TOP + VIEWPORT_PADDING_BOTTOM;
  return {
    width: Math.max(
      MIN_WIDTH,
      Math.round(window.innerWidth - horizontalPadding),
    ),
    height: Math.max(
      MIN_HEIGHT,
      Math.round(window.innerHeight - AUTO_HEIGHT_RESERVED - verticalPadding),
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
  padding?: Partial<ViewportPadding>;
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

  const basePadding: ViewportPadding = {
    top: VIEWPORT_PADDING_TOP,
    right: VIEWPORT_PADDING_RIGHT,
    bottom: VIEWPORT_PADDING_BOTTOM,
    left: VIEWPORT_PADDING_LEFT,
    ...params.padding,
  };

  applyViewportPaddingStyles(viewportHost, basePadding);
  const appliedPadding = getAppliedViewportPadding(viewportHost, basePadding);

  const availableWidth = Math.max(
    1,
    viewportHost.clientWidth - appliedPadding.left - appliedPadding.right,
  );
  const availableHeight = Math.max(
    1,
    viewportHost.clientHeight - appliedPadding.top - appliedPadding.bottom,
  );
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
