import {
  createModalDialogView as createDesignSystemModalDialogView,
  createShareQrDialog as createDesignSystemShareQrDialog,
  type ShareQrDialog,
} from "@smalldraw/design-system";
import { el, mount, unmount } from "redom";
import { createUiIntentStore } from "../controller/stores/createUiIntentStore";
import { DesignSystemKidsDrawToolbarView } from "../designSystem/DesignSystemKidsDrawToolbar";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import { KidsDrawStageView } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";

export type ConfirmDialogViewLike = {
  readonly el: HTMLDivElement;
  showConfirm(input: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    icon?: import("lucide").IconNode;
  }): Promise<boolean>;
};

export type PresentationRuntime = {
  element: HTMLDivElement;
  toolbar: KidsDrawToolbar;
  stage: KidsDrawStageView;
  modalDialog: ConfirmDialogViewLike;
  shareQrDialog: ShareQrDialog;
  uiIntentStore: ReturnType<typeof createUiIntentStore>;
  destroy(): void;
};

export function createPresentationRuntime(options: {
  container: HTMLElement;
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  sidebarItems: ToolbarItem[];
  width: number;
  height: number;
  backgroundColor: string;
}): PresentationRuntime {
  const element = el("div.kids-draw-app") as HTMLDivElement;
  element.dataset.runtimeVariant = "design-system";
  const uiIntentStore = createUiIntentStore();

  const toolbar: KidsDrawToolbar = new DesignSystemKidsDrawToolbarView({
    tools: options.tools,
    families: options.families,
    sidebarItems: options.sidebarItems,
    uiIntentStore,
  });
  const stage = new KidsDrawStageView({
    width: options.width,
    height: options.height,
    backgroundColor: options.backgroundColor,
    uiIntentStore,
  });
  const modalDialog: ConfirmDialogViewLike =
    createDesignSystemModalDialogView();
  const shareQrDialog: ShareQrDialog = createDesignSystemShareQrDialog();

  toolbar.setCanvasContent(stage.element);
  mount(element, toolbar.el);
  mount(element, modalDialog.el);
  mount(element, shareQrDialog.el);
  mount(options.container, element);

  return {
    element,
    toolbar,
    stage,
    modalDialog,
    shareQrDialog,
    uiIntentStore,
    destroy() {
      unmount(options.container, element);
    },
  };
}
