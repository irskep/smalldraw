import { normalizePixelRatio } from "../layout/responsiveLayout";
import type { RasterPipeline } from "../render/createRasterPipeline";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbarView } from "../view/KidsDrawToolbar";
import type { MobilePortraitActionsView } from "../view/MobilePortraitActionsView";
import type { InputSessionController } from "./createInputSessionController";
import {
  LayoutController,
  type LayoutControllerDependencies,
} from "./createLayoutController";
import { RenderLoopController } from "./createRenderLoopController";
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";

type RenderingRuntimeOptions = Omit<
  LayoutControllerDependencies,
  "renderLoopController"
> & {
  stage: KidsDrawStage;
  toolbar: KidsDrawToolbarView;
  mobilePortraitActionsView: MobilePortraitActionsView;
  toolbarUiStore: Pick<
    ToolbarUiStore,
    "get" | "setMobileTopPanel" | "setMobileActionsOpen"
  >;
  pipeline: RasterPipeline;
  backgroundColor: string;
  runtimeStore: Pick<
    KidsDrawRuntimeStore,
    | "$destroyed"
    | "$layoutProfile"
    | "$viewportMetrics"
    | "getPresentationIdentity"
  >;
  resolvePageSize: () => { width: number; height: number };
  getSize: () => { width: number; height: number };
  setSize: (size: { width: number; height: number }) => void;
  inputSessionController: Pick<InputSessionController, "onRenderPass">;
  syncToolbarUi: () => void;
  perfSession: {
    recordRenderPassStart: () => number;
    recordRenderPassEnd: (startMs: number) => void;
    onRafFrameExecuted: () => void;
  };
};

export function createKidsDrawRenderingRuntime(
  options: RenderingRuntimeOptions,
) {
  const renderLoopController = new RenderLoopController(
    {
      pipeline: options.pipeline,
      backgroundColor: options.backgroundColor,
      getSize: options.getSize,
      getPresentationIdentity: () =>
        options.runtimeStore.getPresentationIdentity(),
      onRenderPass: () => {
        const startMs = options.perfSession.recordRenderPassStart();
        options.inputSessionController.onRenderPass();
        options.syncToolbarUi();
        options.pipeline.render();
        options.pipeline.updateDirtyRectOverlay();
        options.perfSession.recordRenderPassEnd(startMs);
      },
      perfSession: {
        onRafFrameExecuted: () => options.perfSession.onRafFrameExecuted(),
      },
    },
    normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    ),
  );

  const layoutController = new LayoutController({
    ...options,
    renderLoopController,
  });

  return {
    renderLoopController,
    layoutController,
    positionMobilePortraitActionsPopover: (): void => {
      layoutController.positionMobilePortraitActionsPopover();
    },
    applyToolbarLayoutProfile: (): void => {
      layoutController.applyToolbarLayoutProfile(
        layoutController.getCurrentLayoutProfile(),
      );
    },
    resolveImplicitDocumentSizeFromViewport: (): {
      width: number;
      height: number;
    } => layoutController.resolveImplicitDocumentSizeFromViewport(),
    applyCanvasSize: (nextWidth: number, nextHeight: number): void => {
      layoutController.applyCanvasSize(nextWidth, nextHeight);
    },
    applyLayoutAndPixelRatio: (): void => {
      layoutController.applyLayoutAndPixelRatio();
    },
    scheduleResponsiveLayout: (): void => {
      layoutController.scheduleResponsiveLayout();
    },
  };
}
