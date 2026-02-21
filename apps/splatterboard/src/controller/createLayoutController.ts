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
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";

type ToggleButton = {
  el: HTMLButtonElement;
  setSelected(selected: boolean): void;
};

type TriggerButton = {
  el: HTMLButtonElement;
};

export class LayoutController {
  private displayScale = 1;
  private displayWidth: number;
  private displayHeight: number;
  private currentLayoutProfile: ResponsiveLayoutProfile;
  private mobilePortraitActionsOpen = false;
  private layoutRafHandle: number | null = null;

  constructor(
    private readonly options: {
      stage: KidsDrawStage;
      toolbar: KidsDrawToolbar;
      resolvePageSize: () => { width: number; height: number };
      getSize: () => { width: number; height: number };
      setSize: (size: DrawingDocumentSize) => void;
      getDestroyed: () => boolean;
      onUpdateViewport: (width: number, height: number) => void;
      onUpdateRenderIdentity: () => void;
      onRequestRenderFromModel: () => void;
      onScheduleResizeBake: () => void;
      setTilePixelRatio: (pixelRatio: number) => void;
      onRefreshCursorMetrics: () => void;
      mobilePortraitBottomStrip: HTMLDivElement;
      mobilePortraitTopStrip: HTMLDivElement;
      mobilePortraitTopControls: HTMLDivElement;
      mobilePortraitActionsPopover: HTMLDivElement;
      mobilePortraitActionsMenu: HTMLDivElement;
      mobilePortraitActionsTrigger: TriggerButton;
      mobilePortraitColorsButton: ToggleButton;
      mobilePortraitStrokesButton: ToggleButton;
      mobileActionsMenuGapPx: number;
      mobileActionsMenuViewportPaddingPx: number;
    },
  ) {
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

  isMobilePortraitActionsOpen(): boolean {
    return this.mobilePortraitActionsOpen;
  }

  setMobilePortraitTopPanel(panel: "colors" | "strokes"): void {
    this.options.mobilePortraitColorsButton.setSelected(panel === "colors");
    this.options.mobilePortraitStrokesButton.setSelected(panel === "strokes");
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
      this.options.mobilePortraitActionsPopover.replaceChildren(
        this.options.mobilePortraitActionsMenu,
      );
      this.options.mobilePortraitActionsPopover.hidden = false;
      this.setMobilePortraitActionsPopoverOpen(this.mobilePortraitActionsOpen);
      this.options.mobilePortraitActionsTrigger.el.setAttribute(
        "aria-expanded",
        this.mobilePortraitActionsOpen ? "true" : "false",
      );
      this.options.mobilePortraitTopControls.replaceChildren(
        this.options.mobilePortraitColorsButton.el,
        this.options.mobilePortraitStrokesButton.el,
        this.options.mobilePortraitActionsTrigger.el,
      );
      this.options.mobilePortraitTopStrip.replaceChildren(
        this.options.mobilePortraitTopControls,
        toolbar.topElement,
        this.options.mobilePortraitActionsPopover,
      );
      this.options.mobilePortraitBottomStrip.replaceChildren(
        toolbar.bottomElement,
        toolbar.toolSelectorElement,
      );
      stage.insetTopSlot.replaceChildren(this.options.mobilePortraitTopStrip);
      stage.insetLeftSlot.replaceChildren();
      stage.insetRightSlot.replaceChildren();
      stage.insetBottomSlot.replaceChildren(this.options.mobilePortraitBottomStrip);
      toolbar.syncLayout();
      this.positionMobilePortraitActionsPopover();
      return;
    }

    this.mobilePortraitActionsOpen = false;
    this.setMobilePortraitTopPanel("colors");
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
    this.options.mobilePortraitActionsPopover.hidden = true;
    this.setMobilePortraitActionsPopoverOpen(false);
    this.options.mobilePortraitActionsTrigger.el.setAttribute(
      "aria-expanded",
      "false",
    );
    this.options.mobilePortraitActionsPopover.style.removeProperty("left");
    this.options.mobilePortraitActionsPopover.style.removeProperty("top");

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

  closeMobilePortraitActions(): void {
    if (!this.mobilePortraitActionsOpen) {
      return;
    }
    this.mobilePortraitActionsOpen = false;
    if (this.currentLayoutProfile === "mobile-portrait") {
      this.applyToolbarLayoutProfile(this.currentLayoutProfile);
    }
  }

  toggleMobilePortraitActions(): void {
    if (this.currentLayoutProfile !== "mobile-portrait") {
      return;
    }
    this.mobilePortraitActionsOpen = !this.mobilePortraitActionsOpen;
    this.applyToolbarLayoutProfile(this.currentLayoutProfile);
    if (this.mobilePortraitActionsOpen) {
      this.positionMobilePortraitActionsPopover();
    }
  }

  positionMobilePortraitActionsPopover(): void {
    if (
      this.currentLayoutProfile !== "mobile-portrait" ||
      !this.mobilePortraitActionsOpen
    ) {
      return;
    }
    const triggerRect =
      this.options.mobilePortraitActionsTrigger.el.getBoundingClientRect();
    const popoverRect = this.options.mobilePortraitActionsPopover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minLeft = this.options.mobileActionsMenuViewportPaddingPx;
    const maxLeft =
      viewportWidth -
      this.options.mobileActionsMenuViewportPaddingPx -
      popoverRect.width;
    const left = Math.max(
      minLeft,
      Math.min(triggerRect.right - popoverRect.width, maxLeft),
    );
    const belowTop = triggerRect.bottom + this.options.mobileActionsMenuGapPx;
    const aboveTop =
      triggerRect.top - this.options.mobileActionsMenuGapPx - popoverRect.height;
    const canPlaceAbove =
      aboveTop >= this.options.mobileActionsMenuViewportPaddingPx;
    const wouldOverflowBottom =
      belowTop + popoverRect.height >
      viewportHeight - this.options.mobileActionsMenuViewportPaddingPx;
    const top =
      wouldOverflowBottom && canPlaceAbove
        ? aboveTop
        : Math.max(
            this.options.mobileActionsMenuViewportPaddingPx,
            Math.min(
              belowTop,
              viewportHeight -
                this.options.mobileActionsMenuViewportPaddingPx -
                popoverRect.height,
            ),
          );
    this.options.mobilePortraitActionsPopover.style.left = `${left}px`;
    this.options.mobilePortraitActionsPopover.style.top = `${top}px`;
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
    this.options.onUpdateViewport(nextWidth, nextHeight);
    this.options.onUpdateRenderIdentity();
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
    this.options.toolbar.syncLayout();
    this.scheduleAnimationFrame(() => {
      if (this.options.getDestroyed()) {
        return;
      }
      this.options.toolbar.syncLayout();
    });
    this.options.onScheduleResizeBake();
    this.options.onRequestRenderFromModel();
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

    const nextPixelRatio = normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    );
    this.options.setTilePixelRatio(nextPixelRatio);

    this.options.onRefreshCursorMetrics();
    this.options.toolbar.syncLayout();
    this.scheduleAnimationFrame(() => {
      if (this.options.getDestroyed()) {
        return;
      }
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
    return this.options.mobilePortraitStrokesButton.el.classList.contains(
      "is-selected",
    )
      ? "strokes"
      : "colors";
  }

  private syncMobilePortraitTopPanel(): void {
    const panel = this.getMobilePortraitTopPanel();
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

  private setMobilePortraitActionsPopoverOpen(open: boolean): void {
    this.options.mobilePortraitActionsPopover.dataset.open = open
      ? "true"
      : "false";
    this.options.mobilePortraitActionsPopover.setAttribute(
      "aria-hidden",
      open ? "false" : "true",
    );
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
}
