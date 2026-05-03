import { CloudAlert, CloudCheck, CloudOff, type IconNode } from "lucide";
import { el } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { Text, type TextKind, type TextTone } from "./Text";
import { TypographicIcon } from "./TypographicIcon";

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

const SYNC_INDICATOR_ICONS: Record<
  Exclude<SyncIndicatorState, "unknown">,
  IconNode
> = {
  "local-only": CloudOff,
  "synced-to-server-but-offline": CloudAlert,
  online: CloudCheck,
};

export class SyncIndicator implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private readonly icon: TypographicIcon;
  private readonly text: Text<"span">;
  private readonly kind: TextKind;
  private readonly tone: TextTone;

  constructor(options: SyncIndicatorOptions = {}) {
    this.kind = options.kind ?? "body";
    this.tone = options.tone ?? "secondary";
    this.icon = new TypographicIcon({
      icon: CloudOff,
      kind: this.kind,
      tone: this.tone,
      className: "ds-sync-indicator__icon",
    });
    this.text = new Text({
      tag: "span",
      kind: this.kind,
      tone: this.tone,
      className: "ds-sync-indicator__text",
    });
    this.el = el("div.ds-sync-indicator", this.icon, this.text) as HTMLDivElement;
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
    this.icon.setIcon(SYNC_INDICATOR_ICONS[state]);
    this.text.setText(SYNC_INDICATOR_LABELS[state]);
  }
}

export function createSyncIndicator(
  options: SyncIndicatorOptions = {},
): SyncIndicator {
  return new SyncIndicator(options);
}
