import {
  createSmalldraw,
  type DrawingDocumentSize,
  DrawingStore,
} from "@smalldraw/core";
import { el, mount, unmount } from "redom";
import { createKidsDrawController } from "../controller/KidsDrawController";
import { resolvePageSize } from "../layout/responsiveLayout";
import { createRasterPipeline } from "../render/createRasterPipeline";
import {
  DEFAULT_KIDS_DRAW_FAMILY_ID,
  getDefaultToolIdForFamily,
  getFamilyIdForTool,
  KIDS_DRAW_SIDEBAR_ITEMS,
  KIDS_DRAW_TOOL_FAMILIES,
  KIDS_DRAW_TOOLS,
} from "../tools/kidsTools";
import {
  $toolbarUi,
  syncToolbarUiFromDrawingStore,
} from "../ui/stores/toolbarUiStore";
import { createKidsDrawStage } from "../view/KidsDrawStage";
import { createKidsDrawToolbar } from "../view/KidsDrawToolbar";
import { createModalDialogView } from "../view/ModalDialog";
import type { KidsDrawApp, KidsDrawAppOptions } from "./types";

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
    families: KIDS_DRAW_TOOL_FAMILIES,
    sidebarItems: KIDS_DRAW_SIDEBAR_ITEMS,
  });
  const stage = createKidsDrawStage({
    width: size.width,
    height: size.height,
    backgroundColor,
  });
  const modalDialog = createModalDialogView();

  mount(element, stage.element);
  mount(stage.insetLeftSlot, toolbar.toolSelectorElement);
  mount(stage.insetRightSlot, toolbar.actionPanelElement);
  mount(stage.insetTopSlot, toolbar.topElement);
  mount(stage.insetBottomSlot, toolbar.bottomElement);
  mount(element, modalDialog.el);
  mount(options.container, element);

  const store = new DrawingStore({
    tools: KIDS_DRAW_TOOLS.map((tool) => tool.createTool()),
    document: core.storeAdapter.getDoc(),
    actionDispatcher: (event) => core.storeAdapter.applyAction(event),
  });
  store.activateTool(getDefaultToolIdForFamily(DEFAULT_KIDS_DRAW_FAMILY_ID));

  const shared = store.getSharedSettings();
  const defaultStrokeWidth = Math.max(
    1,
    Math.round(shared.strokeWidth * KIDS_DRAW_STROKE_WIDTH_MULTIPLIER),
  );
  store.updateSharedSettings({ strokeWidth: defaultStrokeWidth });
  syncToolbarUiFromDrawingStore(store, {
    resolveActiveFamilyId: getFamilyIdForTool,
  });
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
    families: KIDS_DRAW_TOOL_FAMILIES,
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
      modalDialog.onunmount();
      unmount(options.container, element);
    },
  };
}
