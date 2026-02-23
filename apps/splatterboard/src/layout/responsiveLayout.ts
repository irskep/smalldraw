export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 240;
export const AUTO_HEIGHT_RESERVED = 0;
export const IMPLICIT_DOC_VERTICAL_SLACK = 10;
export const VIEWPORT_PADDING_TOP = 24;
export const VIEWPORT_PADDING_RIGHT = 24;
export const VIEWPORT_PADDING_BOTTOM = 24;
export const VIEWPORT_PADDING_LEFT = 24;
export const LARGE_LAYOUT_MIN_WIDTH = 1024;
export const MOBILE_LAYOUT_MAX_WIDTH = 768;
export const SHORT_VIEWPORT_MAX_HEIGHT = 540;

export type ResponsiveLayoutMode = "large" | "medium" | "mobile";
export type ResponsiveLayoutOrientation = "portrait" | "landscape";
export type ResponsiveLayoutProfile =
  | "large"
  | "medium"
  | "mobile-landscape"
  | "mobile-portrait";

export type ViewportPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const LAYOUT_PROFILE_PADDING: Record<ResponsiveLayoutProfile, ViewportPadding> =
  {
    large: {
      top: 136,
      right: 140,
      bottom: 142,
      left: 140,
    },
    medium: {
      top: 136,
      right: 96,
      bottom: 142,
      left: 80,
    },
    "mobile-landscape": {
      top: 120,
      right: 84,
      bottom: 70,
      left: 52,
    },
    "mobile-portrait": {
      top: 170,
      right: 24,
      bottom: 156,
      left: 24,
    },
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
  viewportHost.style.setProperty("--kd-inset-top", top);
  viewportHost.style.setProperty("--kd-inset-right", right);
  viewportHost.style.setProperty("--kd-inset-bottom", bottom);
  viewportHost.style.setProperty("--kd-inset-left", left);
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

export function resolveLogicalSizeFromViewportArea(params: {
  viewportWidth: number;
  viewportHeight: number;
  padding: ViewportPadding;
  verticalSlack?: number;
}): {
  width: number;
  height: number;
} {
  const verticalSlack = params.verticalSlack ?? IMPLICIT_DOC_VERTICAL_SLACK;
  const horizontalPadding = params.padding.left + params.padding.right;
  const verticalPadding = params.padding.top + params.padding.bottom;
  return {
    width: Math.max(
      MIN_WIDTH,
      Math.round(params.viewportWidth - horizontalPadding),
    ),
    height: Math.max(
      MIN_HEIGHT,
      Math.round(
        params.viewportHeight -
          AUTO_HEIGHT_RESERVED -
          verticalPadding -
          verticalSlack,
      ),
    ),
  };
}

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

  const profile = resolveLayoutProfile(window.innerWidth, window.innerHeight);
  const padding = getViewportPaddingForProfile(profile);
  return resolveLogicalSizeFromViewportArea({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    padding,
  });
}

export function resolveLayoutMode(
  width: number,
  height: number,
): ResponsiveLayoutMode {
  if (
    width <= MOBILE_LAYOUT_MAX_WIDTH ||
    (width <= LARGE_LAYOUT_MIN_WIDTH && height <= SHORT_VIEWPORT_MAX_HEIGHT)
  ) {
    return "mobile";
  }
  if (width < LARGE_LAYOUT_MIN_WIDTH) {
    return "medium";
  }
  return "large";
}

export function resolveLayoutOrientation(
  width: number,
  height: number,
): ResponsiveLayoutOrientation {
  return height > width ? "portrait" : "landscape";
}

export function resolveLayoutProfile(
  width: number,
  height: number,
): ResponsiveLayoutProfile {
  const mode = resolveLayoutMode(width, height);
  if (mode === "large") {
    return "large";
  }
  if (mode === "medium") {
    return "medium";
  }
  return resolveLayoutOrientation(width, height) === "portrait"
    ? "mobile-portrait"
    : "mobile-landscape";
}

export function getViewportPaddingForProfile(
  profile: ResponsiveLayoutProfile,
): ViewportPadding {
  return LAYOUT_PROFILE_PADDING[profile];
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
