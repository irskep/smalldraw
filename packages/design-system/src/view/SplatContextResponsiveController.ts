import {
  resolveSplatContextLayout,
  type SplatContextLayout,
  shouldShowMobileShare,
} from "./splatContextLayout";

export type SplatContextResponsiveEffect =
  | "rebuild"
  | "patch-mobile-layout"
  | "sync-only";

export interface SplatContextResponsiveState {
  layout: SplatContextLayout;
  showMobileShare: boolean;
  showSettingsRail: boolean;
}

export interface SplatContextResponsiveUpdate extends SplatContextResponsiveState {
  effect: SplatContextResponsiveEffect;
}

export interface SettingsRailFit {
  documentWidth: number;
  documentHeight: number;
  availableWidth: number;
  availableHeight: number;
  railWidth: number;
  railHeight: number;
}

export function settingsRailFitsWithoutShrinking(
  fit: SettingsRailFit,
): boolean {
  const {
    documentWidth,
    documentHeight,
    availableWidth,
    availableHeight,
    railWidth,
    railHeight,
  } = fit;
  if (
    ![
      documentWidth,
      documentHeight,
      availableWidth,
      availableHeight,
      railWidth,
      railHeight,
    ].every((value) => Number.isFinite(value) && value > 0)
  )
    return false;
  if (availableHeight < railHeight || availableWidth <= railWidth) return false;
  const scale = Math.min(
    1,
    availableWidth / documentWidth,
    availableHeight / documentHeight,
  );
  const scaleWithRail = Math.min(
    1,
    (availableWidth - railWidth) / documentWidth,
    availableHeight / documentHeight,
  );
  return scaleWithRail >= scale;
}

export function resolveSplatContextResponsiveState(
  width: number,
  height: number,
  fit?: SettingsRailFit,
): SplatContextResponsiveState {
  return {
    layout: resolveSplatContextLayout(width, height),
    showMobileShare: shouldShowMobileShare(width),
    showSettingsRail:
      resolveSplatContextLayout(width, height) === "desktop" &&
      ((width >= 1024 &&
        height >= 700 &&
        (!fit || fit.availableHeight >= fit.railHeight)) ||
        (fit !== undefined && settingsRailFitsWithoutShrinking(fit))),
  };
}

export class SplatContextResponsiveController {
  private state: SplatContextResponsiveState;

  constructor(
    initialState: SplatContextResponsiveState = {
      layout: "desktop",
      showMobileShare: false,
      showSettingsRail: false,
    },
  ) {
    this.state = initialState;
  }

  getState(): SplatContextResponsiveState {
    return this.state;
  }

  update(
    width: number,
    height: number,
    fit?: SettingsRailFit,
  ): SplatContextResponsiveUpdate {
    const nextState = resolveSplatContextResponsiveState(width, height, fit);

    if (
      nextState.layout === this.state.layout &&
      nextState.showMobileShare === this.state.showMobileShare &&
      nextState.showSettingsRail === this.state.showSettingsRail
    ) {
      return {
        effect: "sync-only",
        ...nextState,
      };
    }

    if (nextState.layout === this.state.layout) {
      this.state = nextState;
      return {
        effect: "sync-only",
        ...nextState,
      };
    }

    const effect =
      this.state.layout === "desktop" || nextState.layout === "desktop"
        ? "rebuild"
        : "patch-mobile-layout";
    this.state = nextState;

    return {
      effect,
      ...nextState,
    };
  }
}
