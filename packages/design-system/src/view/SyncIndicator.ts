import {
  AlertTriangle,
  CloudAlert,
  CloudCheck,
  CloudOff,
  type IconNode,
} from "lucide";
import { el } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { Text, type TextKind, type TextTone } from "./Text";
import { TypographicIcon } from "./TypographicIcon";

export type SyncIndicatorState =
  | "unknown"
  | "local-only"
  | "synced-to-server-but-offline"
  | "error"
  | "online";

export interface SyncIndicatorOptions {
  state?: SyncIndicatorState;
  kind?: TextKind;
  tone?: TextTone;
  description?: string;
}

const SYNC_INDICATOR_LABELS: Record<
  Exclude<SyncIndicatorState, "unknown">,
  string
> = {
  "local-only": "Local only",
  "synced-to-server-but-offline": "Offline",
  error: "Sync issue",
  online: "Online",
};

const SYNC_INDICATOR_ICONS: Record<
  Exclude<SyncIndicatorState, "unknown">,
  IconNode
> = {
  "local-only": CloudOff,
  "synced-to-server-but-offline": CloudAlert,
  error: AlertTriangle,
  online: CloudCheck,
};

export class SyncIndicator implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private readonly icon: TypographicIcon;
  private readonly text: Text<"span">;
  private readonly kind: TextKind;
  private readonly tone: TextTone;
  private description = "";

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
    this.setState(options.state ?? "unknown", options.description);
  }

  setState(state: SyncIndicatorState, description = this.description): void {
    this.el.dataset.state = state;
    this.description = description;
    if (state === "unknown") {
      this.el.hidden = true;
      this.text.setText("");
      this.el.removeAttribute("title");
      this.el.removeAttribute("aria-label");
      return;
    }
    this.el.hidden = false;
    this.icon.setIcon(SYNC_INDICATOR_ICONS[state]);
    const label = SYNC_INDICATOR_LABELS[state];
    this.text.setText(label);
    const detail = description.trim();
    if (detail.length > 0) {
      this.el.title = detail;
      this.el.setAttribute("aria-label", `${label}: ${detail}`);
    } else {
      this.el.removeAttribute("title");
      this.el.setAttribute("aria-label", label);
    }
  }

  setDescription(description: string): void {
    this.setState(
      (this.el.dataset.state as SyncIndicatorState | undefined) ?? "unknown",
      description,
    );
  }
}

export function createSyncIndicator(
  options: SyncIndicatorOptions = {},
): SyncIndicator {
  return new SyncIndicator(options);
}
