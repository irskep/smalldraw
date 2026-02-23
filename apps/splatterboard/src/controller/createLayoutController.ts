import type { DrawingDocumentSize } from "@smalldraw/core";
import { isLayoutDebugEnabled } from "../config/devFlags";
import { resolveMobileActionsPopoverPosition } from "../layout/mobileActionsPopoverPosition";
import {
  applyResponsiveLayout,
  getViewportPaddingForProfile,
  normalizePixelRatio,
  type ResponsiveLayoutMode,
  type ResponsiveLayoutProfile,
  resolveLayoutProfile,
  resolveLogicalSizeFromViewportArea,
} from "../layout/responsiveLayout";
import type { RasterPipeline } from "../render/createRasterPipeline";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbarView } from "../view/KidsDrawToolbar";
import type { MobilePortraitActionsView } from "../view/MobilePortraitActionsView";
import type { RenderLoopController } from "./createRenderLoopController";
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";

export const DEFAULT_MOBILE_ACTIONS_MENU_GAP_PX = 8;
export const DEFAULT_MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX = 8;

export type LayoutControllerDependencies = {
  stage: KidsDrawStage;
  toolbar: KidsDrawToolbarView;
  resolvePageSize: () => { width: number; height: number };
  getSize: () => { width: number; height: number };
  setSize: (size: DrawingDocumentSize) => void;
  runtimeStore: Pick<
    KidsDrawRuntimeStore,
    "$destroyed" | "$layoutProfile" | "$viewportMetrics"
  >;
  pipeline: Pick<RasterPipeline, "updateViewport">;
  renderLoopController: Pick<
    RenderLoopController,
    | "updateRenderIdentity"
    | "requestRenderFromModel"
    | "scheduleResizeBake"
    | "setTilePixelRatio"
  >;
  mobilePortraitActionsView: MobilePortraitActionsView;
  toolbarUiStore: Pick<
    ToolbarUiStore,
    "get" | "setMobileTopPanel" | "setMobileActionsOpen"
  >;
  mobileActionsMenuGapPx?: number;
  mobileActionsMenuViewportPaddingPx?: number;
};

export class LayoutController {
  private displayScale = 1;
  private displayWidth: number;
  private displayHeight: number;
  private currentLayoutProfile: ResponsiveLayoutProfile;
  private layoutRafHandle: number | null = null;

  constructor(private readonly options: LayoutControllerDependencies) {
    const initialSize = options.getSize();
    this.displayWidth = initialSize.width;
    this.displayHeight = initialSize.height;
    this.currentLayoutProfile = resolveLayoutProfile(
      window.innerWidth,
      window.innerHeight,
    );
    if (
      this.options.runtimeStore.$layoutProfile.get() !==
      this.currentLayoutProfile
    ) {
      this.options.runtimeStore.$layoutProfile.set(this.currentLayoutProfile);
    }
    this.logLayoutTransition({
      reason: "init",
      previousProfile: null,
      nextProfile: this.currentLayoutProfile,
    });
  }

  getCurrentLayoutProfile(): ResponsiveLayoutProfile {
    return this.currentLayoutProfile;
  }

  applyToolbarLayoutProfile(profile: ResponsiveLayoutProfile): void {
    const { stage, toolbar } = this.options;
    const mode = this.resolveModeForProfile(profile);
    stage.setViewportLayout({
      profile,
    });
    toolbar.setGridMode(mode);

    if (profile === "mobile-portrait") {
      this.syncMobilePortraitTopPanel();
      const mobileActionsOpen =
        this.options.toolbarUiStore.get().mobileActionsOpen;
      toolbar.mountMobilePortraitLayout({
        topSlot: stage.insetTopSlot,
        bottomSlot: stage.insetBottomSlot,
        mobilePortraitActionsView: this.options.mobilePortraitActionsView,
        actionsOpen: mobileActionsOpen,
      });
      stage.clearSideInsetSlots();
      toolbar.syncLayout();
      this.positionMobilePortraitActionsPopover();
      return;
    }

    this.options.toolbarUiStore.setMobileActionsOpen(false);
    this.options.toolbarUiStore.setMobileTopPanel("colors");
    this.options.mobilePortraitActionsView.unmountMobileLayout();
    toolbar.showDesktopTopPanels();
    toolbar.mountDesktopLayout({
      topSlot: stage.insetTopSlot,
      leftSlot: stage.insetLeftSlot,
      rightSlot: stage.insetRightSlot,
      bottomSlot: stage.insetBottomSlot,
    });
    toolbar.syncLayout();
  }

  syncLayoutProfile(): void {
    const previousProfile = this.currentLayoutProfile;
    this.currentLayoutProfile = resolveLayoutProfile(
      window.innerWidth,
      window.innerHeight,
    );
    if (
      this.options.runtimeStore.$layoutProfile.get() !==
      this.currentLayoutProfile
    ) {
      this.options.runtimeStore.$layoutProfile.set(this.currentLayoutProfile);
    }
    this.logLayoutTransition({
      reason: "sync",
      previousProfile,
      nextProfile: this.currentLayoutProfile,
    });
    this.applyToolbarLayoutProfile(this.currentLayoutProfile);
  }

  positionMobilePortraitActionsPopover(): void {
    if (
      this.currentLayoutProfile !== "mobile-portrait" ||
      !this.options.toolbarUiStore.get().mobileActionsOpen
    ) {
      return;
    }
    const triggerRect =
      this.options.mobilePortraitActionsView.getActionsTriggerRect();
    const popoverRect =
      this.options.mobilePortraitActionsView.getActionsPopoverRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportPaddingPx =
      this.options.mobileActionsMenuViewportPaddingPx ??
      DEFAULT_MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX;
    const gapPx =
      this.options.mobileActionsMenuGapPx ?? DEFAULT_MOBILE_ACTIONS_MENU_GAP_PX;
    const { left, top } = resolveMobileActionsPopoverPosition({
      triggerRect,
      popoverRect,
      viewportWidth,
      viewportHeight,
      viewportPaddingPx,
      gapPx,
    });
    this.options.mobilePortraitActionsView.setPopoverPosition(left, top);
  }

  resolveImplicitDocumentSizeFromViewport(): {
    width: number;
    height: number;
  } {
    const fallback = this.options.resolvePageSize();
    const host = this.options.stage.viewportHost;
    const hostWidth = Math.round(host.clientWidth);
    const hostHeight = Math.round(host.clientHeight);
    if (hostWidth <= 0 || hostHeight <= 0) {
      return fallback;
    }
    return resolveLogicalSizeFromViewportArea({
      viewportWidth: hostWidth,
      viewportHeight: hostHeight,
      padding: this.getViewportPadding(),
    });
  }

  applyCanvasSize(nextWidth: number, nextHeight: number): void {
    const size = this.options.getSize();
    if (size.width === nextWidth && size.height === nextHeight) {
      return;
    }
    this.options.setSize({ width: nextWidth, height: nextHeight });
    this.options.stage.setSceneDimensions(nextWidth, nextHeight);
    this.options.pipeline.updateViewport(nextWidth, nextHeight);
    this.options.renderLoopController.updateRenderIdentity();
    this.applyResponsiveLayoutForSize(nextWidth, nextHeight);
    this.syncToolbarAndViewportMetrics(nextWidth, nextHeight, {
      refreshWithLatestSizeOnNextFrame: false,
    });
    this.options.renderLoopController.scheduleResizeBake();
    this.options.renderLoopController.requestRenderFromModel();
  }

  applyLayoutAndPixelRatio(): void {
    this.syncLayoutProfile();
    const size = this.options.getSize();
    this.applyResponsiveLayoutForSize(size.width, size.height);

    const nextPixelRatio = normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    );
    this.options.renderLoopController.setTilePixelRatio(nextPixelRatio);
    this.syncToolbarAndViewportMetrics(size.width, size.height, {
      refreshWithLatestSizeOnNextFrame: true,
    });
  }

  scheduleResponsiveLayout(): void {
    if (this.layoutRafHandle !== null) {
      return;
    }
    this.layoutRafHandle = this.scheduleAnimationFrame(() => {
      this.layoutRafHandle = null;
      this.applyLayoutAndPixelRatio();
    });
  }

  dispose(): void {
    if (this.layoutRafHandle !== null) {
      this.cancelAnimationFrameHandle(this.layoutRafHandle);
      this.layoutRafHandle = null;
    }
  }

  private resolveModeForProfile(
    profile: ResponsiveLayoutProfile,
  ): ResponsiveLayoutMode {
    if (profile === "large") {
      return "large";
    }
    if (profile === "medium") {
      return "medium";
    }
    return "mobile";
  }

  private getMobilePortraitTopPanel(): "colors" | "strokes" {
    return this.options.toolbarUiStore.get().mobileTopPanel;
  }

  private syncMobilePortraitTopPanel(): void {
    const panel = this.getMobilePortraitTopPanel();
    this.options.toolbar.setMobileTopPanel(panel);
    this.options.mobilePortraitActionsView.setTopPanel(panel);
  }

  private getViewportPadding(): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } {
    return getViewportPaddingForProfile(this.currentLayoutProfile);
  }

  private scheduleAnimationFrame(callback: FrameRequestCallback): number {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  }

  private cancelAnimationFrameHandle(handle: number): void {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  }

  private publishViewportMetrics(
    logicalWidth: number,
    logicalHeight: number,
  ): void {
    const rect = this.options.stage.overlay.getBoundingClientRect();
    const nextMetrics = {
      overlayLeft: rect.left,
      overlayTop: rect.top,
      overlayWidth: rect.width,
      overlayHeight: rect.height,
      logicalWidth,
      logicalHeight,
    };
    const currentMetrics = this.options.runtimeStore.$viewportMetrics.get();
    if (
      currentMetrics.overlayLeft === nextMetrics.overlayLeft &&
      currentMetrics.overlayTop === nextMetrics.overlayTop &&
      currentMetrics.overlayWidth === nextMetrics.overlayWidth &&
      currentMetrics.overlayHeight === nextMetrics.overlayHeight &&
      currentMetrics.logicalWidth === nextMetrics.logicalWidth &&
      currentMetrics.logicalHeight === nextMetrics.logicalHeight
    ) {
      return;
    }
    this.options.runtimeStore.$viewportMetrics.set(nextMetrics);
  }

  private applyResponsiveLayoutForSize(
    logicalWidth: number,
    logicalHeight: number,
  ): void {
    const updated = applyResponsiveLayout({
      viewportHost: this.options.stage.viewportHost,
      canvasFrame: this.options.stage.canvasFrame,
      sceneRoot: this.options.stage.sceneRoot,
      width: logicalWidth,
      height: logicalHeight,
      displayScale: this.displayScale,
      displayWidth: this.displayWidth,
      displayHeight: this.displayHeight,
      padding: this.getViewportPadding(),
    });
    this.displayScale = updated.displayScale;
    this.displayWidth = updated.displayWidth;
    this.displayHeight = updated.displayHeight;
  }

  private syncToolbarAndViewportMetrics(
    logicalWidth: number,
    logicalHeight: number,
    options: { refreshWithLatestSizeOnNextFrame: boolean },
  ): void {
    this.publishViewportMetrics(logicalWidth, logicalHeight);
    this.options.toolbar.syncLayout();
    if (!options.refreshWithLatestSizeOnNextFrame) {
      return;
    }
    this.scheduleAnimationFrame(() => {
      if (this.options.runtimeStore.$destroyed.get()) {
        return;
      }
      const latestSize = this.options.getSize();
      this.publishViewportMetrics(latestSize.width, latestSize.height);
      this.options.toolbar.syncLayout();
    });
  }

  private logLayoutTransition(params: {
    reason: "init" | "sync";
    previousProfile: ResponsiveLayoutProfile | null;
    nextProfile: ResponsiveLayoutProfile;
  }): void {
    if (!isLayoutDebugEnabled()) {
      return;
    }
    const visualViewport = window.visualViewport;
    console.debug("[kids-draw:layout]", {
      reason: params.reason,
      previousProfile: params.previousProfile,
      nextProfile: params.nextProfile,
      mode: this.resolveModeForProfile(params.nextProfile),
      orientation:
        window.innerHeight > window.innerWidth ? "portrait" : "landscape",
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualViewport: visualViewport
        ? {
            width: Math.round(visualViewport.width),
            height: Math.round(visualViewport.height),
            offsetLeft: Math.round(visualViewport.offsetLeft),
            offsetTop: Math.round(visualViewport.offsetTop),
            scale: visualViewport.scale,
          }
        : null,
    });
  }
}
