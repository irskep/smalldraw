import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import type { PeerId, PeerMetadata } from "@automerge/automerge-repo/slim";

/** A server takedown is terminal, unlike a temporary network disconnection. */
export class ModerationWebSocketAdapter extends BrowserWebSocketClientAdapter {
  private unavailable = false;

  constructor(url: string, onUnavailable: (documentId: string) => void) {
    super(url);
    const onClose = this.onClose;
    this.onClose = (event?: { code: number; reason: string }) => {
      if (event?.code === 4004) {
        this.unavailable = true;
        const id = event.reason.replace(/^Drawing unavailable:/, "");
        this.disconnect();
        if (/^[A-Za-z0-9_-]+$/.test(id)) onUnavailable(id);
      } else onClose();
    };
  }

  override connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    if (!this.unavailable) super.connect(peerId, peerMetadata);
  }

  override disconnect(): void {
    // The unavailable UI clears its auth token and removes this adapter again.
    // The upstream adapter asserts on that second disconnect.
    if (this.socket && this.peerId) super.disconnect();
  }
}
