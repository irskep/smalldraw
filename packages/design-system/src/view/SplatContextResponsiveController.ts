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

export function resolveSplatContextResponsiveState(
  width: number,
  height: number,
): SplatContextResponsiveState {
  return {
    layout: resolveSplatContextLayout(width, height),
    showMobileShare: shouldShowMobileShare(width),
    showSettingsRail: width >= 1024 && height >= 700,
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

  update(width: number, height: number): SplatContextResponsiveUpdate {
    const nextState = resolveSplatContextResponsiveState(width, height);

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
