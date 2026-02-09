import {
  DrawingStore,
  createSmalldraw,
  type DrawingDocumentSize,
} from "@smalldraw/core";
import { el, mount, unmount } from "redom";
import { createKidsDrawController } from "../controller/KidsDrawController";
import { resolvePageSize } from "../layout/responsiveLayout";
import { createRasterPipeline } from "../render/createRasterPipeline";
import {
  $toolbarUi,
  syncToolbarUiFromDrawingStore,
} from "../ui/stores/toolbarUiStore";
import {
  ensureModalDialogDefined,
  ModalDialogElement,
} from "../view/ModalDialog";
import { createKidsDrawStage } from "../view/KidsDrawStage";
import { createKidsDrawToolbar } from "../view/KidsDrawToolbar";
import type { KidsDrawApp, KidsDrawAppOptions } from "./types";
import {
  DEFAULT_KIDS_DRAW_TOOL_ID,
  KIDS_DRAW_TOOLS,
} from "../tools/kidsTools";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;
const KIDS_DRAW_STROKE_WIDTH_MULTIPLIER = 3;

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
  const hasExplicitSize =
    options.width !== undefined || options.height !== undefined;
  const getExplicitSize = (): DrawingDocumentSize => ({
    width: options.width ?? DEFAULT_WIDTH,
    height: options.height ?? DEFAULT_HEIGHT,
  });
  const resolveCurrentPageSize = (): DrawingDocumentSize =>
    resolvePageSize(getExplicitSize());

  const desiredInitialSize: DrawingDocumentSize = hasExplicitSize
    ? getExplicitSize()
    : resolveCurrentPageSize();

  const providedCore = options.core;
  const core =
    providedCore ??
    (await createSmalldraw({
      persistence: {
        storageKey: "kids-draw-doc-url",
        mode: "reuse",
      },
      documentSize: desiredInitialSize,
    }));

  const docSize = core.storeAdapter.getDoc().size;
  let size = {
    width: docSize.width,
    height: docSize.height,
  };

  const backgroundColor = options.backgroundColor ?? "#ffffff";

  const element = el("div.kids-draw-app") as HTMLDivElement;

  const toolbar = createKidsDrawToolbar({
    tools: KIDS_DRAW_TOOLS,
  });
  const stage = createKidsDrawStage({
    width: size.width,
    height: size.height,
    backgroundColor,
  });
  ensureModalDialogDefined();
  const modalDialog = document.createElement(
    ModalDialogElement.tagName,
  ) as ModalDialogElement;

  mount(element, stage.element);
  mount(stage.insetLeftSlot, toolbar.toolSelectorElement);
  mount(stage.insetRightSlot, toolbar.actionPanelElement);
  mount(stage.insetTopSlot, toolbar.element);
  mount(element, modalDialog);
  mount(options.container, element);

  const store = new DrawingStore({
    tools: KIDS_DRAW_TOOLS.map((tool) => tool.createTool()),
    document: core.storeAdapter.getDoc(),
    actionDispatcher: (event) => core.storeAdapter.applyAction(event),
  });
  store.activateTool(DEFAULT_KIDS_DRAW_TOOL_ID);

  const shared = store.getSharedSettings();
  const defaultStrokeWidth = Math.max(
    1,
    Math.round(shared.strokeWidth * KIDS_DRAW_STROKE_WIDTH_MULTIPLIER),
  );
  store.updateSharedSettings({ strokeWidth: defaultStrokeWidth });
  syncToolbarUiFromDrawingStore(store);
  const unbindToolbarUi = toolbar.bindUiState($toolbarUi);

  const pipeline = createRasterPipeline({
    store,
    stage,
    width: size.width,
    height: size.height,
    backgroundColor,
    tilePixelRatio:
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1,
    renderIdentity: "kids-draw-init",
  });

  pipeline.bakeInitialShapes(Object.values(store.getDocument().shapes));

  const controller = createKidsDrawController({
    store,
    core,
    toolbar,
    tools: KIDS_DRAW_TOOLS,
    stage,
    pipeline,
    backgroundColor,
    hasExplicitSize,
    providedCore: Boolean(providedCore),
    resolvePageSize: resolveCurrentPageSize,
    getExplicitSize,
    getSize: () => ({ ...size }),
    setSize: (nextSize) => {
      size = nextSize;
    },
    confirmDestructiveAction:
      options.confirmDestructiveAction ??
      ((dialog) => modalDialog.showConfirm(dialog)),
  });

  return {
    element,
    store,
    overlay: stage.overlay,
    core,
    destroy() {
      controller.destroy();
      unbindToolbarUi();
      unmount(options.container, element);
    },
  };
}
