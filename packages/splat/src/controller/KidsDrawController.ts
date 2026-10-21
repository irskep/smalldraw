import type {
  DrawingDocumentSize,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
import type { SplatContextDocumentSlot } from "@smalldraw/design-system";
import { Vec2 } from "@smalldraw/geometry";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import type { UsageAnalytics } from "@smalldraw/shared";
import { type IconNode, Trash2 } from "lucide";
import { mount, unmount } from "redom";
import type { AccountSession } from "../app/createAccountSession";
import { createDrawingUsageAnalytics } from "../app/usageAnalytics";
import type { KidsDocumentBackend, KidsDocumentSummary } from "../documents";
import {
  automergeUrlToDocumentId,
  resolveDocumentClaimState,
} from "../documents";
import { createKidsDrawPerfSession } from "../perf/kidsDrawPerf";
import type { RasterPipeline } from "../render/createRasterPipeline";
import type {
  KidsToolCatalog,
  KidsToolConfig,
  KidsToolFamilyConfig,
} from "../tools/kidsTools";
import {
  createToolbarUiPersistence,
  type ToolbarUiPersistence,
} from "../ui/stores/toolbarUiPersistence";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import { createDocumentBrowserDialogView } from "../view/DocumentBrowserDialogView";
import { GlobalEventSurface } from "../view/GlobalEventSurface";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import { createNewDocumentDialogView } from "../view/NewDocumentDialogView";
import type { SharePayload } from "./createCollaborativeUpgradeCoordinator";
import { createCursorOverlayController } from "./createCursorOverlayController";
import { createDocumentBrowserCommands } from "./createDocumentBrowserCommands";
import { DocumentPickerController } from "./createDocumentPickerController";
import {
  createDocumentRuntimeController,
  type DocumentRuntimeController,
} from "./createDocumentRuntimeController";
import { InputSessionController } from "./createInputSessionController";
import { createKidsDrawInteractionRuntime } from "./createKidsDrawInteractionRuntime";
import { createKidsDrawRenderingRuntime } from "./createKidsDrawRenderingRuntime";
import { createLifecycleScope } from "./createLifecycleScope";
import { SnapshotService } from "./createSnapshotService";
import { ToolbarStateController } from "./createToolbarStateController";
import { logDiagnosticEvent } from "./diagnostics/diagnosticLogger";
import type {
  CollaborationStatus,
  CollaborationStatusStore,
} from "./stores/createCollaborationStatusStore";
import {
  type ActiveDocumentState,
  createKidsDrawRuntimeStore,
  type DocumentAccessDisplay,
} from "./stores/createKidsDrawRuntimeStore";
import { createStartupReadinessStore } from "./stores/createStartupReadinessStore";
import type { UiIntentStore } from "./stores/createUiIntentStore";

type ConfirmDialogRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
};

export interface KidsDrawController {
  freezeForAccountTransition(): Promise<void>;
  openDocument(docUrl: string): Promise<void>;
  destroy(): void;
}

export interface KidsDrawSizingPolicy {
  hasExplicitSize: boolean;
  getExplicitSize: () => DrawingDocumentSize;
}

function toClaimErrorMessage(
  reason:
    | "not_collaborative"
    | "already_attached"
    | "missing_access_token"
    | "wrong_access_scope",
): string {
  switch (reason) {
    case "not_collaborative":
      return "Only shared drawings can be claimed.";
    case "already_attached":
      return "This drawing is already attached to your account.";
    case "missing_access_token":
      return "This browser does not have a claim token for this drawing.";
    case "wrong_access_scope":
      return "This browser only has join access for this drawing.";
  }
}

function toUiOpenDocumentErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    /document .* is unavailable/i.test(error.message)
  ) {
    return "This drawing is no longer stored in this browser.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Failed to open this drawing.";
}

export function createKidsDrawController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  toolbar: KidsDrawToolbar;
  catalog: KidsToolCatalog;
  shapeRendererRegistry: ShapeRendererRegistry;
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  uiIntentStore: UiIntentStore;
  stage: KidsDrawStage;
  toolbarUiStore: ToolbarUiStore;
  pipeline: RasterPipeline;
  appElement: HTMLDivElement;
  documentBackend: KidsDocumentBackend;
  resolveAssetUrl?: (src: string) => string;
  collaborationStatusStore: Pick<
    CollaborationStatusStore,
    "setCurrentDocument" | "getStatus" | "subscribe"
  >;
  backgroundColor: string;
  initialSize: DrawingDocumentSize;
  sizingPolicy: KidsDrawSizingPolicy;
  providedCore: boolean;
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  savePngExport?: (input: {
    suggestedName: string;
    blob?: Blob;
    dataUrl?: string;
  }) => Promise<boolean>;
  createDocumentCopy?: (existingUrl?: string) => {
    url: string;
    binary: Uint8Array;
  };
  publishShareThumbnail?: (
    accessToken: string,
    thumbnail: Blob,
  ) => Promise<void>;
  registerCollaborativeDocument?: (
    documentId: string,
    content: Uint8Array,
  ) => Promise<{
    joinSecret: string;
    accessToken: string;
    accessTokenScope: "owner";
  }>;
  registerAccountSyncedDocument?: (
    documentId: string,
    content: Uint8Array,
  ) => Promise<{
    accessToken: string;
    accessTokenScope: "owner";
  }>;
  createShareInvitation?: (documentId: string) => Promise<{ token: string }>;
  accountSession?: AccountSession;
  claimCollaborativeDocument?: (accessToken: string) => Promise<void>;
  deleteCollaborativeDocument?: (documentId: string) => Promise<void>;
  removeCollaborativeDocumentFromAccount?: (
    documentId: string,
  ) => Promise<void>;
  uploadDocumentThumbnail?: (
    document: KidsDocumentSummary,
    thumbnail: Blob,
  ) => Promise<void>;
  onThumbnailSaved?: (docUrl: string, thumbnail: Blob) => Promise<void> | void;
  initialCatalogDocUrl?: string;
  initialDocumentAccessState?:
    | {
        type: "error";
        reason: string;
        display: DocumentAccessDisplay;
      }
    | {
        type: "none";
        reason: string;
        display: DocumentAccessDisplay;
      };
  startupNewDocument?: "blank" | "coloring-picker";
  beforeOpenDocument?: (
    summary: KidsDocumentSummary | null,
  ) => Promise<void> | void;
  resolveJoinBaseUrl?: () => string;
  showShareDialog: (payload: SharePayload) => Promise<void>;
  isSharingAllowed?: () => boolean;
  requestSharePermission?: () => Promise<boolean>;
  openParentalControls: () => Promise<boolean>;
  onShareError?: (message: string) => void;
  onClaimError?: (message: string) => void;
  analytics?: UsageAnalytics;
  onDocumentCreationCancelled?: () => void;
  onDocumentOpenRequested?: (
    summary: KidsDocumentSummary | null,
    docUrl: string,
  ) => void;
  onCurrentDocumentSummaryChanged?: (
    summary: KidsDocumentSummary | null,
  ) => void;
}): KidsDrawController {
  const {
    store,
    core,
    toolbar,
    catalog,
    shapeRendererRegistry,
    tools,
    families,
    uiIntentStore,
    stage,
    toolbarUiStore,
    pipeline,
    appElement,
    documentBackend,
    collaborationStatusStore,
    backgroundColor,
    initialSize,
    sizingPolicy,
    providedCore,
    confirmDestructiveAction,
    savePngExport,
    createDocumentCopy,
    registerCollaborativeDocument,
    publishShareThumbnail,
    registerAccountSyncedDocument,
    createShareInvitation,
    onThumbnailSaved,
    initialCatalogDocUrl,
    initialDocumentAccessState,
    startupNewDocument,
    beforeOpenDocument,
    resolveJoinBaseUrl,
    showShareDialog,
    isSharingAllowed,
    requestSharePermission,
    openParentalControls,
    onShareError,
    onClaimError,
    onDocumentOpenRequested,
  } = options;
  let size = {
    width: initialSize.width,
    height: initialSize.height,
  };
  const getSize = (): DrawingDocumentSize => ({ ...size });
  const setSize = (nextSize: DrawingDocumentSize): void => {
    size = nextSize;
  };

  const perfSession = createKidsDrawPerfSession();
  const lifecycleScope = createLifecycleScope();
  const { add } = lifecycleScope;

  const runtimeStore = createKidsDrawRuntimeStore();
  const startupReadinessStore = createStartupReadinessStore();
  const snapshotService = new SnapshotService({
    store,
    shapeRendererRegistry,
    backgroundColor,
  });
  const cursorOverlay = createCursorOverlayController({
    store,
    stage,
    cursorModeByToolId: new Map(
      tools.map((tool) => [tool.id, tool.cursorMode] as const),
    ),
    cursorPreviewIconByToolId: new Map(
      tools.flatMap((tool) =>
        tool.cursorPreviewIcon
          ? ([[tool.id, tool.cursorPreviewIcon]] as const)
          : [],
      ),
    ),
    viewportMetricsStore: runtimeStore.$viewportMetrics,
  });
  let toolbarStateController: ToolbarStateController;
  let toolbarUiPersistence: ToolbarUiPersistence;
  const syncToolbarUi = (): void => {
    toolbarStateController.syncToolbarUi();
  };
  const globalEventSurface = new GlobalEventSurface();

  const debugLifecycle = (...args: unknown[]): void => {
    if (
      !(globalThis as { __kidsDrawDebugLifecycle?: boolean })
        .__kidsDrawDebugLifecycle
    ) {
      return;
    }
    console.debug("[kids-draw:lifecycle]", ...args);
  };

  const documentBrowserDialog = createDocumentBrowserDialogView({
    onOpen: () => {
      void options.accountSession?.refresh();
    },
    onAccountAction: () => {
      const account = options.accountSession;
      if (!account) return;
      const state = account.$state.get();
      if (state.status === "signed-in") void account.signOut();
      else if (state.status === "signed-out")
        account.signIn(
          runtimeDocumentController.getActiveDocumentDocUrl() ?? undefined,
        );
      else void account.refresh();
    },
    onClose: () => {
      documentPickerController.close();
    },
    onOpenCreateDialog: () => {
      documentPickerController.openCreateDialog();
    },
    onOpenDocument: (docUrl) => {
      void openDocumentFromBrowser(docUrl).catch((error) => {
        const message = toUiOpenDocumentErrorMessage(error);
        console.error("[kids-draw:documents] unhandled open failure", {
          docUrl,
          message,
          error,
        });
      });
    },
    onClaimDocument: (docUrl) => {
      if (options.accountSession?.$state.get().status === "signed-out") {
        options.accountSession.signIn(docUrl);
        return;
      }
      void claimDocumentFromBrowser(docUrl);
    },
    onDeleteDocument: (docUrl) => {
      void deleteDocumentFromBrowser(docUrl);
    },
  });
  if (options.accountSession) {
    add(
      options.accountSession.$state.subscribe((state) =>
        documentBrowserDialog.setAccountState(state),
      ),
    );
  }
  const newDocumentDialog = createNewDocumentDialogView({
    resolveAssetUrl: options.resolveAssetUrl,
    onClose: () => {
      documentPickerController.closeCreateDialog();
      if (runtimeStore.getActiveDocument().type === "none") {
        options.onDocumentCreationCancelled?.();
      }
    },
    onCreate: (request) => {
      void createNewDocumentFromBrowser(request);
    },
  });
  mount(appElement, documentBrowserDialog.el);
  mount(appElement, newDocumentDialog.el);
  let documentRuntimeController: DocumentRuntimeController | null = null;
  const documentPickerController = new DocumentPickerController({
    browserDialog: documentBrowserDialog,
    newDocumentDialog,
    documentBackend,
    getCurrentDocUrl: () =>
      documentRuntimeController?.getActiveDocumentDocUrl() ?? null,
  });
  toolbarStateController = new ToolbarStateController({
    store,
    toolbarUiStore,
    catalog,
    families,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
    cursorOverlaySync: () => cursorOverlay.sync(),
  });
  toolbarUiPersistence = createToolbarUiPersistence({
    toolbarUiStore,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
  });
  let scheduleThumbnailSaveForInput: (delayMs: number) => void = () => {};
  const inputSessionController = new InputSessionController({
    store,
    cursorOverlay,
    overlayElement: stage.overlay,
    initialLastPointerPoint: new Vec2(0, 0),
    toPoint: (event) => cursorOverlay.toPoint(event),
    onScheduleThumbnailSave: (delayMs) => {
      scheduleThumbnailSaveForInput(delayMs);
    },
    perfSession: {
      begin: () => perfSession.begin(),
      end: (frameCount) => perfSession.end(frameCount),
      onPointerMoveSamples: (sampleCount, usedCoalesced) =>
        perfSession.onPointerMoveSamples(sampleCount, usedCoalesced),
    },
  });
  const {
    renderLoopController,
    layoutController,
    resolveImplicitDocumentSizeFromViewport,
    applyCanvasSize,
    applyLayoutAndPixelRatio,
    scheduleResponsiveLayout,
  } = createKidsDrawRenderingRuntime({
    stage,
    toolbar,
    pipeline,
    backgroundColor,
    runtimeStore,
    getSize,
    setSize,
    inputSessionController,
    syncToolbarUi,
    perfSession,
  });

  documentRuntimeController = createDocumentRuntimeController({
    store,
    core,
    documentBackend,
    snapshotService,
    runtimeStore,
    onCurrentDocumentSummaryChanged: (summary) => {
      collaborationStatusStore.setCurrentDocument(summary);
      options.onCurrentDocumentSummaryChanged?.(summary);
    },
    startupReadinessStore,
    toolbarStateController,
    renderLoopController,
    pipeline,
    syncToolbarUi,
    applyCanvasSize,
    getDocumentSizeFromViewport: () =>
      resolveImplicitDocumentSizeFromViewport(),
    fallbackDocumentSizeForCreate: initialSize,
    hasExplicitSize: sizingPolicy.hasExplicitSize,
    getExplicitSize: sizingPolicy.getExplicitSize,
    createDocumentCopy,
    registerCollaborativeDocument,
    publishShareThumbnail,
    registerAccountSyncedDocument,
    createShareInvitation,
    onThumbnailSaved,
    initialCatalogDocUrl,
    initialDocumentAccessState,
    startupNewDocument,
    beforeOpenDocument,
    resolveJoinBaseUrl,
  });
  const runtimeDocumentController = documentRuntimeController;
  scheduleThumbnailSaveForInput = (delayMs) => {
    runtimeDocumentController.scheduleThumbnailSave(delayMs);
  };

  const documentBrowserCommands = createDocumentBrowserCommands({
    documentPickerController,
    getCurrentDocUrl: () => runtimeDocumentController.getActiveDocumentDocUrl(),
    switchToDocument: (docUrl) =>
      runtimeDocumentController.switchToDocument(docUrl),
    createNewDocument: (request) =>
      runtimeDocumentController.createNewDocument(request),
    flushThumbnailSave: () => runtimeDocumentController.flushThumbnailSave(),
    listDocuments: () => documentBackend.listDocuments(),
    claimDocument: async (document) => {
      if (options.accountSession) {
        await options.accountSession.refresh();
        if (options.accountSession.$state.get().status === "signed-out") {
          options.accountSession.signIn(document.docUrl);
          return;
        }
        if (options.accountSession.$state.get().status !== "signed-in")
          throw new Error(
            "Could not check your sign-in status. Please try again.",
          );
      }
      if (!document.collaborative) {
        await runtimeDocumentController.switchToDocument(document.docUrl);
        await runtimeDocumentController.syncCurrentDocumentToAccount();
        return;
      }
      if (!options.claimCollaborativeDocument) {
        throw new Error("Account claim is not configured");
      }
      const claimState = resolveDocumentClaimState(document);
      console.info("[kids-draw:documents] claim state evaluated", {
        docUrl: document.docUrl,
        collaborative: document.collaborative ?? false,
        collabDocUrl: document.collabDocUrl ?? null,
        accessToken: document.accessToken ? "<present>" : null,
        accessTokenScope: document.accessTokenScope ?? null,
        claimState,
      });
      if (!claimState.claimable) {
        throw new Error(toClaimErrorMessage(claimState.reason));
      }
      await options.claimCollaborativeDocument(claimState.accessToken);
      const attachedDocument = await documentBackend.createDocument({
        docUrl: document.docUrl,
        accountAttached: true,
      });
      const thumbnail = await documentBackend.getThumbnail(document.docUrl);
      if (thumbnail && options.uploadDocumentThumbnail) {
        await options.uploadDocumentThumbnail(attachedDocument, thumbnail);
      }
    },
    isClaimableDocument: (document) =>
      (!document.collaborative &&
        !document.accountAttached &&
        !!options.accountSession) ||
      resolveDocumentClaimState(document).claimable,
    describeClaimability: (document) => ({
      claimState: resolveDocumentClaimState(document),
    }),
    deleteDocument: async (docUrl) => {
      const document = await documentBackend.getDocument(docUrl);
      if (document?.accountAttached && document.collabDocUrl) {
        const documentId = automergeUrlToDocumentId(document.collabDocUrl);
        if (!documentId) {
          throw new Error("Shared drawing id is invalid.");
        }
        if (document.canDeleteFromServer) {
          if (!options.deleteCollaborativeDocument) {
            throw new Error("Server deletion is not configured.");
          }
          await options.deleteCollaborativeDocument(documentId);
        } else {
          if (!options.removeCollaborativeDocumentFromAccount) {
            throw new Error("Account removal is not configured.");
          }
          await options.removeCollaborativeDocumentFromAccount(documentId);
        }
      }
      await documentBackend.deleteDocument(docUrl);
    },
    confirmDelete: (document) =>
      confirmDestructiveAction({
        title: document.accountAttached
          ? document.canDeleteFromServer
            ? "Delete shared drawing?"
            : "Remove shared drawing?"
          : "Delete drawing?",
        message: document.accountAttached
          ? document.canDeleteFromServer
            ? "This stops syncing and removes server access. People who already opened it may still have a local copy in their browser."
            : "This removes the drawing from your account and this browser. People who already opened it may still have a local copy in their browser."
          : "This deletes the drawing from this browser.",
        confirmLabel: document.accountAttached
          ? document.canDeleteFromServer
            ? "Delete"
            : "Remove"
          : "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
        icon: Trash2,
      }),
    onClaimError,
    onDocumentOpenRequested,
    isDestroyed: () => runtimeStore.isDestroyed(),
  });
  const {
    closeDocumentPicker,
    openDocumentPicker,
    createNewDocumentFromBrowser,
    openDocumentFromBrowser,
    claimDocumentFromBrowser,
    deleteDocumentFromBrowser,
  } = documentBrowserCommands;
  const unbindGlobalIntents = globalEventSurface.bindIntents({
    windowTarget: window,
    documentTarget: document,
    isDocumentPickerOpen: () => documentPickerController.isOpen(),
    uiIntentStore,
  });
  add(unbindGlobalIntents);
  const { commandController } = createKidsDrawInteractionRuntime({
    store,
    toolbarUiStore,
    toolbarStateController,
    inputSessionController,
    cursorOverlay,
    uiIntentStore,
    lifecycle: { add },
    documentBrowserCommands: {
      closeDocumentPicker,
      openDocumentPicker,
      shareCurrentDocument: async () => {
        console.info("[kids-draw:multiplayer] ui share bridge start");
        const payload = await runtimeDocumentController.shareCurrentDocument();
        console.info("[kids-draw:multiplayer] ui share bridge payload ready", {
          catalogDocUrl: payload.catalogDocUrl,
          collabDocUrl: payload.collabDocUrl,
          upgraded: payload.upgraded,
        });
        await showShareDialog(payload);
        console.info("[kids-draw:multiplayer] ui share dialog shown");
      },
      isSharingAllowed,
      requestSharePermission,
    },
    openParentalControls,
    snapshotService,
    getSize,
    confirmDestructiveAction,
    savePngExport,
    runtimeStore,
    documentPickerController,
    scheduleResponsiveLayout,
    debugLifecycle,
    onShareError,
  });

  const applyCollaborationStatus = (status: CollaborationStatus): void => {
    toolbar.setCollaborationStatus(status);
  };
  applyCollaborationStatus(collaborationStatusStore.getStatus());
  const unbindCollaborationStatus = collaborationStatusStore.subscribe(
    applyCollaborationStatus,
  );
  add(unbindCollaborationStatus);

  store.setOnRenderNeeded(() => {
    perfSession.onModelInvalidation();
    syncToolbarUi();
    renderLoopController.requestRenderFromModel();
  });
  const usage = createDrawingUsageAnalytics(options.analytics, tools);
  store.setOnAction((event) => {
    usage.action(event, store.getActiveToolId());
    const affectedShapeIds = event.action.affectedShapeIds();
    logDiagnosticEvent("store_action", {
      actionType: event.type,
      actionName: event.action.constructor?.name ?? "unknown_action",
      affectedShapeCount: affectedShapeIds.length,
      affectedShapeIds: affectedShapeIds.slice(0, 8),
      documentShapeCount: Object.keys(event.doc.shapes).length,
    });
  });

  toolbarUiPersistence.start();
  let latestActiveDocument = runtimeStore.getActiveDocument();
  let latestStartupReadiness = startupReadinessStore.getState();
  const syncShellForDocumentState = (): void => {
    const hasLoadedDocument = latestActiveDocument.type === "loaded";
    if (hasLoadedDocument && latestStartupReadiness.interactionEnabled)
      usage.opened(store.getDocument());
    toolbarUiStore.setHasLoadedDocument(hasLoadedDocument);
    stage.setCanvasVisible(hasLoadedDocument);
    stage.setInteractionEnabled(
      hasLoadedDocument && latestStartupReadiness.interactionEnabled,
    );
    toolbar.setDocumentSlot(
      resolveDocumentSlot(latestActiveDocument, stage.element),
    );
    stage.setStartupStatus({
      visible: hasLoadedDocument && !latestStartupReadiness.interactionEnabled,
      phase: latestStartupReadiness.phase,
      assetsLoaded: latestStartupReadiness.assetsLoaded,
      assetsTotal: latestStartupReadiness.assetsTotal,
      assetsFailed: latestStartupReadiness.assetsFailed,
      blockingReason: latestStartupReadiness.lastBlockingReason,
    });
  };
  const unbindActiveDocument = runtimeStore.subscribeActiveDocument(
    (activeDocument) => {
      const wasLoaded = latestActiveDocument.type === "loaded";
      latestActiveDocument = activeDocument;
      if (activeDocument.type === "error" || activeDocument.type === "none") {
        collaborationStatusStore.setCurrentDocument(null);
      }
      syncShellForDocumentState();
      if (!wasLoaded && activeDocument.type === "loaded") {
        scheduleResponsiveLayout();
      }
    },
  );
  add(unbindActiveDocument);
  const unbindStartupReadiness = startupReadinessStore.subscribe((state) => {
    latestStartupReadiness = state;
    syncShellForDocumentState();
  });
  add(unbindStartupReadiness);
  syncShellForDocumentState();
  runtimeDocumentController.start();
  if (startupNewDocument === "coloring-picker") {
    documentPickerController.openCreateDialog("coloring");
  }
  renderLoopController.updateRenderIdentity();
  applyLayoutAndPixelRatio();
  renderLoopController.scheduleResizeBake();
  renderLoopController.requestRenderFromModel();

  return {
    async freezeForAccountTransition() {
      inputSessionController.forceCancelPointerSession("pointerUp");
      stage.setInteractionEnabled(false);
      commandController.destroy();
      await runtimeDocumentController.flushThumbnailSave();
      runtimeStore.setDestroyed(true);
      runtimeDocumentController.dispose();
    },
    async openDocument(docUrl: string): Promise<void> {
      await runtimeDocumentController.switchToDocument(docUrl);
    },
    destroy() {
      runtimeStore.setDestroyed(true);
      commandController.destroy();
      debugLifecycle("destroy");

      store.setOnRenderNeeded(undefined);
      store.setOnAction(undefined);
      toolbarUiPersistence.stop();
      toolbarUiPersistence.flush();
      runtimeDocumentController.dispose();
      documentPickerController.dispose();
      layoutController.dispose();
      renderLoopController.dispose();
      cursorOverlay.dispose();
      stage.destroy();

      lifecycleScope.disposeAll();

      pipeline.dispose();
      unmount(appElement, documentBrowserDialog.el);
      unmount(appElement, newDocumentDialog.el);
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}

function resolveDocumentSlot(
  activeDocument: ActiveDocumentState,
  stageElement: HTMLElement,
): SplatContextDocumentSlot {
  if (activeDocument.type === "loaded") {
    return { type: "document", content: stageElement };
  }
  if (activeDocument.type === "loading") {
    return describeDocumentLoading(activeDocument.reason);
  }
  return {
    type: activeDocument.type,
    title: activeDocument.display.title,
    description: activeDocument.display.description,
    message: activeDocument.display.message,
    recoveryActions: "retry-and-reset",
  };
}

function describeDocumentLoading(reason: string): SplatContextDocumentSlot & {
  type: "loading";
} {
  if (reason === "share_document") {
    return {
      type: "loading",
      title: "Sharing drawing…",
      recoveryActions: "none",
    };
  }
  if (reason === "switch_document") {
    return {
      type: "loading",
      title: "Opening drawing…",
      recoveryActions: "none",
    };
  }
  if (reason === "create_document") {
    return {
      type: "loading",
      title: "Creating drawing…",
      recoveryActions: "none",
    };
  }
  return {
    type: "loading",
    title: "Loading drawing…",
    recoveryActions: "none",
  };
}
