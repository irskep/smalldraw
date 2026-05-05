import {
  resolveSplatContextLayout,
  shouldShowMobileShare,
  type SplatContextLayout,
} from "./splatContextLayout";

export type SplatContextResponsiveEffect =
  | "rebuild"
  | "patch-mobile-layout"
  | "sync-only";

export interface SplatContextResponsiveState {
  layout: SplatContextLayout;
  showMobileShare: boolean;
}

export interface SplatContextResponsiveUpdate
  extends SplatContextResponsiveState {
  effect: SplatContextResponsiveEffect;
}

export function resolveSplatContextResponsiveState(
  width: number,
  height: number,
): SplatContextResponsiveState {
  return {
    layout: resolveSplatContextLayout(width, height),
    showMobileShare: shouldShowMobileShare(width),
  };
}

export class SplatContextResponsiveController {
  private state: SplatContextResponsiveState;

  constructor(
    initialState: SplatContextResponsiveState = {
      layout: "desktop",
      showMobileShare: false,
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
      nextState.showMobileShare === this.state.showMobileShare
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
