import { AlertTriangle, Trash2 } from "lucide";
import { el, mount } from "redom";
import { createModalDialogView, createShareQrDialog } from "../../src";
import type { HarnessStory } from "./types";

export const dialogStories: HarnessStory[] = [
  {
    id: "modal-dialog",
    title: "Modal Dialog",
    description: "Confirm/cancel dialog with optional icon and danger tone.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "No result yet.",
      ) as HTMLOutputElement;
      const dialog = createModalDialogView();

      const openDefault = el(
        "button",
        { type: "button" },
        "No icon",
      ) as HTMLButtonElement;
      openDefault.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Save changes?",
          message: "You have unsaved changes that will be lost.",
          confirmLabel: "Save",
          cancelLabel: "Discard",
        });
        status.textContent = result ? "Confirmed" : "Cancelled";
      });

      const openDanger = el(
        "button",
        { type: "button" },
        "Danger with icon",
      ) as HTMLButtonElement;
      openDanger.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Delete drawing?",
          message: "This action cannot be undone.",
          confirmLabel: "Delete",
          tone: "danger",
          icon: Trash2,
        });
        status.textContent = result
          ? "Confirmed (danger)"
          : "Cancelled (danger)";
      });

      const openIcon = el(
        "button",
        { type: "button" },
        "Default with icon",
      ) as HTMLButtonElement;
      openIcon.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Warning",
          message: "Something needs your attention.",
          confirmLabel: "OK",
          icon: AlertTriangle,
        });
        status.textContent = result ? "Confirmed (icon)" : "Cancelled (icon)";
      });

      const controls = el(
        "div.ds-story-row",
        openDefault,
        openDanger,
        openIcon,
      );
      canvas.append(controls, status);
      container.replaceChildren(canvas);
      mount(container, dialog);
    },
  },
  {
    id: "share-qr-dialog",
    title: "Share QR Dialog",
    description: "Dialog showing a QR code and copyable URL for sharing.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Dialog not opened yet.",
      ) as HTMLOutputElement;
      const dialog = createShareQrDialog();

      const placeholderQr =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='white'/%3E%3Ctext x='128' y='140' text-anchor='middle' font-size='24' fill='%23666'%3EQR placeholder%3C/text%3E%3C/svg%3E";

      const openButton = el(
        "button",
        { type: "button" },
        "Open share dialog",
      ) as HTMLButtonElement;
      openButton.addEventListener("click", async () => {
        status.textContent = "Dialog open…";
        await dialog.show({
          joinUrl: "https://example.com/join/abc123",
          qrDataUrl: placeholderQr,
        });
        status.textContent = "Dialog closed.";
      });

      const controls = el("div.ds-story-row", openButton);
      canvas.append(controls, status);
      container.replaceChildren(canvas);
      mount(container, dialog);
    },
  },
];
