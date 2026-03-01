import {
  createSmalldraw,
  type DrawingDocumentSize,
  DrawingStore,
} from "@smalldraw/core";
import { el, mount, unmount } from "redom";
import { createKidsDrawController } from "../controller/KidsDrawController";
import { createUiIntentStore } from "../controller/stores/createUiIntentStore";
import { createLocalDocumentBackend } from "../documents";
import { resolveLayoutMode, resolvePageSize } from "../layout/responsiveLayout";
import { createRasterPipeline } from "../render/createRasterPipeline";
import { createKidsShapeRendererRegistry } from "../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import {
  createKidsToolCatalog,
  getDefaultToolIdForFamily,
  getFamilyIdForTool,
  getToolStyleSupport,
} from "../tools/kidsTools";
import { warmImageStampAssets } from "../tools/stamps/imageStampAssets";
import { getImageStampAssets } from "../tools/stamps/imageStampCatalog";
import { createToolbarUiStore } from "../ui/stores/toolbarUiStore";
import { KidsDrawStageView } from "../view/KidsDrawStage";
import { KidsDrawToolbarView } from "../view/KidsDrawToolbar";
import { createModalDialogView } from "../view/ModalDialog";
import { installMobileGestureGuards } from "./installMobileGestureGuards";
import type {
  KidsDrawApp,
  KidsDrawAppCommands,
  KidsDrawAppOptions,
} from "./types";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
  const uninstallMobileGestureGuards = installMobileGestureGuards();
  warmImageStampAssets(getImageStampAssets().map((asset) => asset.src));

  const hasExplicitSize =
    options.width !== undefined || options.height !== undefined;
  const getExplicitSize = (): DrawingDocumentSize => ({
    width: options.width ?? DEFAULT_WIDTH,
    height: options.height ?? DEFAULT_HEIGHT,
  });
  const resolveCurrentPageSize = (): DrawingDocumentSize =>
    resolvePageSize(getExplicitSize());
  const resolvedImplicitPageSize = resolveCurrentPageSize();

  const desiredInitialSize: DrawingDocumentSize = hasExplicitSize
    ? getExplicitSize()
    : resolvedImplicitPageSize;
  if (typeof window !== "undefined") {
    console.info("[kids-draw:size] initial-page-size", {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      layoutMode: resolveLayoutMode(window.innerWidth, window.innerHeight),
      hasExplicitSize,
      explicitFallback: getExplicitSize(),
      resolvedImplicitPageSize,
      desiredInitialSize,
    });
  }
  const shapeHandlers = createKidsShapeHandlerRegistry();
  const shapeRendererRegistry = createKidsShapeRendererRegistry();
  const documentBackend =
    options.documentBackend ??
    createLocalDocumentBackend({
      currentDocStorageKey: "kids-draw-doc-url",
    });

  const providedCore = options.core;
  const core =
    providedCore ??
    (await createSmalldraw({
      persistence: {
        mode: "reuse",
        getCurrentDocUrl: () => documentBackend.getCurrentDocument(),
        setCurrentDocUrl: (url) => documentBackend.setCurrentDocument(url),
      },
      documentSize: desiredInitialSize,
      shapeHandlers,
    }));

  const docSize = core.storeAdapter.getDoc().size;
  const initialSize = {
    width: docSize.width,
    height: docSize.height,
  };

  const backgroundColor = options.backgroundColor ?? "#ffffff";

  const element = el("div.kids-draw-app") as HTMLDivElement;

  const catalog = createKidsToolCatalog(shapeRendererRegistry);
  const uiIntentStore = createUiIntentStore();

  const toolbar = new KidsDrawToolbarView({
    tools: catalog.tools,
    families: catalog.families,
    sidebarItems: catalog.sidebarItems,
    uiIntentStore,
  });
  const stage = new KidsDrawStageView({
    width: initialSize.width,
    height: initialSize.height,
    backgroundColor,
    uiIntentStore,
  });
  const modalDialog = createModalDialogView();

  mount(element, stage.element);
  toolbar.mountDesktopLayout({
    topSlot: stage.insetTopSlot,
    leftSlot: stage.insetLeftSlot,
    rightSlot: stage.insetRightSlot,
    bottomSlot: stage.insetBottomSlot,
  });
  mount(element, modalDialog.el);
  mount(options.container, element);

  const store = new DrawingStore({
    tools: catalog.tools.map((tool) => tool.tool),
    document: core.storeAdapter.getDoc(),
    actionDispatcher: (event) => core.storeAdapter.applyAction(event),
    shapeHandlers,
  });
  store.activateTool(
    getDefaultToolIdForFamily(catalog.defaultFamilyId, catalog),
  );
  const toolbarUiStore = createToolbarUiStore();
  toolbarUiStore.syncFromDrawingStore(store, {
    resolveActiveFamilyId: (toolId) => getFamilyIdForTool(toolId, catalog),
    resolveToolStyleSupport: (toolId) => getToolStyleSupport(toolId, catalog),
  });
  const unbindToolbarUi = toolbar.bindUiState(toolbarUiStore.$state);

  const pipeline = createRasterPipeline({
    store,
    stage,
    shapeRendererRegistry,
    width: initialSize.width,
    height: initialSize.height,
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
    catalog,
    shapeRendererRegistry,
    tools: catalog.tools,
    families: catalog.families,
    uiIntentStore,
    stage,
    toolbarUiStore,
    pipeline,
    appElement: element,
    documentBackend,
    backgroundColor,
    initialSize,
    sizingPolicy: {
      hasExplicitSize,
      getExplicitSize,
      resolvePageSize: resolveCurrentPageSize,
    },
    providedCore: Boolean(providedCore),
    confirmDestructiveAction:
      options.confirmDestructiveAction ??
      ((dialog) => modalDialog.showConfirm(dialog)),
    savePngExport: options.savePngExport,
  });

  const commands: KidsDrawAppCommands = {
    undo(): void {
      uiIntentStore.publish({ type: "undo" });
    },
    redo(): void {
      uiIntentStore.publish({ type: "redo" });
    },
    clear(): void {
      uiIntentStore.publish({ type: "clear" });
    },
    export(): void {
      uiIntentStore.publish({ type: "export" });
    },
    newDrawing(): void {
      uiIntentStore.publish({ type: "new_drawing" });
    },
    browse(): void {
      uiIntentStore.publish({ type: "browse" });
    },
  };

  return {
    element,
    store,
    overlay: stage.overlay,
    core,
    commands,
    destroy() {
      controller.destroy();
      unbindToolbarUi();
      modalDialog.onunmount();
      unmount(options.container, element);
      uninstallMobileGestureGuards();
    },
  };
}
