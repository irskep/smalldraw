import { el } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { Text, type TextKind, type TextTone } from "./Text";

export type SyncIndicatorState =
  | "unknown"
  | "local-only"
  | "synced-to-server-but-offline"
  | "online";

export interface SyncIndicatorOptions {
  state?: SyncIndicatorState;
  kind?: TextKind;
  tone?: TextTone;
}

const SYNC_INDICATOR_LABELS: Record<
  Exclude<SyncIndicatorState, "unknown">,
  string
> = {
  "local-only": "Local only",
  "synced-to-server-but-offline": "Offline",
  online: "Online",
};

export class SyncIndicator implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private readonly text: Text<"span">;

  constructor(options: SyncIndicatorOptions = {}) {
    this.text = new Text({
      tag: "span",
      kind: options.kind ?? "body",
      tone: options.tone ?? "secondary",
      className: "ds-sync-indicator__text",
    });
    this.el = el("div.ds-sync-indicator", this.text) as HTMLDivElement;
    this.setState(options.state ?? "unknown");
  }

  setState(state: SyncIndicatorState): void {
    this.el.dataset.state = state;
    if (state === "unknown") {
      this.el.hidden = true;
      this.text.setText("");
      return;
    }
    this.el.hidden = false;
    this.text.setText(SYNC_INDICATOR_LABELS[state]);
  }
}

export function createSyncIndicator(
  options: SyncIndicatorOptions = {},
): SyncIndicator {
  return new SyncIndicator(options);
}
