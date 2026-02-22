import type { DrawingDocumentSize } from "@smalldraw/core";
import {
  applyResponsiveLayout,
  getViewportPaddingForProfile,
  IMPLICIT_DOC_VERTICAL_SLACK,
  MIN_HEIGHT,
  MIN_WIDTH,
  normalizePixelRatio,
  type ResponsiveLayoutMode,
  type ResponsiveLayoutProfile,
  resolveLayoutProfile,
} from "../layout/responsiveLayout";
import type { RasterPipeline } from "../render/createRasterPipeline";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import type { MobilePortraitActionsView } from "../view/MobilePortraitActionsView";
import type { RenderLoopController } from "./createRenderLoopController";
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";

export const DEFAULT_MOBILE_ACTIONS_MENU_GAP_PX = 8;
export const DEFAULT_MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX = 8;

export type LayoutControllerDependencies = {
  stage: KidsDrawStage;
  toolbar: KidsDrawToolbar;
  resolvePageSize: () => { width: number; height: number };
  getSize: () => { width: number; height: number };
  setSize: (size: DrawingDocumentSize) => void;
  runtimeStore: Pick<
    KidsDrawRuntimeStore,
    "isDestroyed" | "setViewportMetrics"
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
  }

  getCurrentLayoutProfile(): ResponsiveLayoutProfile {
    return this.currentLayoutProfile;
  }

  applyToolbarLayoutProfile(profile: ResponsiveLayoutProfile): void {
    const { stage, toolbar } = this.options;
    const orientation =
      window.innerHeight > window.innerWidth ? "portrait" : "landscape";
    stage.viewportHost.dataset.layoutProfile = profile;
    stage.viewportHost.dataset.layoutMode = this.resolveModeForProfile(profile);
    stage.viewportHost.dataset.layoutOrientation = orientation;

    if (profile === "mobile-portrait") {
      this.syncMobilePortraitTopPanel();
      const mobileActionsOpen =
        this.options.toolbarUiStore.get().mobileActionsOpen;
      this.options.mobilePortraitActionsView.mountMobileLayout({
        topSlot: stage.insetTopSlot,
        bottomSlot: stage.insetBottomSlot,
        toolbarTopElement: toolbar.topElement,
        toolbarBottomElement: toolbar.bottomElement,
        toolSelectorElement: toolbar.toolSelectorElement,
        actionsOpen: mobileActionsOpen,
      });
      stage.insetLeftSlot.replaceChildren();
      stage.insetRightSlot.replaceChildren();
      toolbar.syncLayout();
      this.positionMobilePortraitActionsPopover();
      return;
    }

    this.options.toolbarUiStore.setMobileActionsOpen(false);
    this.options.toolbarUiStore.setMobileTopPanel("colors");
    this.options.mobilePortraitActionsView.unmountMobileLayout();
    const colorsPanel = toolbar.topElement.querySelector(
      ".kids-draw-toolbar-colors",
    ) as HTMLDivElement | null;
    const strokePanel = toolbar.topElement.querySelector(
      ".kids-draw-toolbar-strokes",
    ) as HTMLDivElement | null;
    if (colorsPanel) {
      colorsPanel.hidden = false;
    }
    if (strokePanel) {
      strokePanel.hidden = false;
    }
    stage.insetTopSlot.replaceChildren(toolbar.topElement);
    stage.insetLeftSlot.replaceChildren(toolbar.toolSelectorElement);
    stage.insetRightSlot.replaceChildren(toolbar.actionPanelElement);
    stage.insetBottomSlot.replaceChildren(toolbar.bottomElement);
    toolbar.syncLayout();
  }

  syncLayoutProfile(): void {
    this.currentLayoutProfile = resolveLayoutProfile(
      window.innerWidth,
      window.innerHeight,
    );
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
    const minLeft = viewportPaddingPx;
    const maxLeft = viewportWidth - viewportPaddingPx - popoverRect.width;
    const left = Math.max(
      minLeft,
      Math.min(triggerRect.right - popoverRect.width, maxLeft),
    );
    const belowTop = triggerRect.bottom + gapPx;
    const aboveTop = triggerRect.top - gapPx - popoverRect.height;
    const canPlaceAbove = aboveTop >= viewportPaddingPx;
    const wouldOverflowBottom =
      belowTop + popoverRect.height > viewportHeight - viewportPaddingPx;
    const top =
      wouldOverflowBottom && canPlaceAbove
        ? aboveTop
        : Math.max(
            viewportPaddingPx,
            Math.min(
              belowTop,
              viewportHeight - viewportPaddingPx - popoverRect.height,
            ),
          );
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
    const styles = window.getComputedStyle(host);
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const width = Math.max(
      MIN_WIDTH,
      Math.round(hostWidth - paddingLeft - paddingRight),
    );
    const height = Math.max(
      MIN_HEIGHT,
      Math.round(
        hostHeight - paddingTop - paddingBottom - IMPLICIT_DOC_VERTICAL_SLACK,
      ),
    );
    return { width, height };
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
    const updated = applyResponsiveLayout({
      viewportHost: this.options.stage.viewportHost,
      canvasFrame: this.options.stage.canvasFrame,
      sceneRoot: this.options.stage.sceneRoot,
      width: nextWidth,
      height: nextHeight,
      displayScale: this.displayScale,
      displayWidth: this.displayWidth,
      displayHeight: this.displayHeight,
      padding: this.getViewportPadding(),
    });
    this.displayScale = updated.displayScale;
    this.displayWidth = updated.displayWidth;
    this.displayHeight = updated.displayHeight;
    this.publishViewportMetrics(nextWidth, nextHeight);
    this.options.toolbar.syncLayout();
    this.scheduleAnimationFrame(() => {
      if (this.options.runtimeStore.isDestroyed()) {
        return;
      }
      this.publishViewportMetrics(nextWidth, nextHeight);
      this.options.toolbar.syncLayout();
    });
    this.options.renderLoopController.scheduleResizeBake();
    this.options.renderLoopController.requestRenderFromModel();
  }

  applyLayoutAndPixelRatio(): void {
    this.syncLayoutProfile();
    const size = this.options.getSize();
    const updated = applyResponsiveLayout({
      viewportHost: this.options.stage.viewportHost,
      canvasFrame: this.options.stage.canvasFrame,
      sceneRoot: this.options.stage.sceneRoot,
      width: size.width,
      height: size.height,
      displayScale: this.displayScale,
      displayWidth: this.displayWidth,
      displayHeight: this.displayHeight,
      padding: this.getViewportPadding(),
    });
    this.displayScale = updated.displayScale;
    this.displayWidth = updated.displayWidth;
    this.displayHeight = updated.displayHeight;
    this.publishViewportMetrics(size.width, size.height);

    const nextPixelRatio = normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    );
    this.options.renderLoopController.setTilePixelRatio(nextPixelRatio);
    this.options.toolbar.syncLayout();
    this.scheduleAnimationFrame(() => {
      if (this.options.runtimeStore.isDestroyed()) {
        return;
      }
      const latestSize = this.options.getSize();
      this.publishViewportMetrics(latestSize.width, latestSize.height);
      this.options.toolbar.syncLayout();
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
    this.options.mobilePortraitActionsView.setTopPanel(panel);
    const colorsPanel = this.options.toolbar.topElement.querySelector(
      ".kids-draw-toolbar-colors",
    ) as HTMLDivElement | null;
    const strokePanel = this.options.toolbar.topElement.querySelector(
      ".kids-draw-toolbar-strokes",
    ) as HTMLDivElement | null;
    if (colorsPanel) {
      colorsPanel.hidden = panel !== "colors";
    }
    if (strokePanel) {
      strokePanel.hidden = panel !== "strokes";
    }
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
    this.options.runtimeStore.setViewportMetrics({
      overlayLeft: rect.left,
      overlayTop: rect.top,
      overlayWidth: rect.width,
      overlayHeight: rect.height,
      logicalWidth,
      logicalHeight,
    });
  }
}
