import {
  type DocHandle,
  type Message,
  NetworkAdapter,
  type PeerId,
} from "@automerge/automerge-repo/slim";

/** Real Repo sync messages; only transport delivery/disconnection is controlled. */
export class ControlledNetwork extends NetworkAdapter {
  other?: ControlledNetwork;
  online = false;
  sent = 0;
  private generation = 0;
  private resolveConnected!: () => void;
  readonly connected = new Promise<void>((resolve) => {
    this.resolveConnected = resolve;
  });

  isReady() {
    return true;
  }
  whenReady() {
    return Promise.resolve();
  }
  connect(peerId: PeerId) {
    this.peerId = peerId;
    this.resolveConnected();
  }
  disconnect() {
    this.goOffline();
  }

  goOffline() {
    this.online = false;
    this.generation++;
    if (this.other?.peerId && this.peerId) {
      this.emit("peer-disconnected", { peerId: this.other.peerId });
      this.other.emit("peer-disconnected", { peerId: this.peerId });
    }
  }

  goOnline(other: ControlledNetwork) {
    this.other = other;
    other.other = this;
    this.online = other.online = true;
    this.emit("peer-candidate", { peerId: other.peerId!, peerMetadata: {} });
    other.emit("peer-candidate", { peerId: this.peerId!, peerMetadata: {} });
  }

  send(message: Message) {
    if (!this.online || !this.other?.online) return;
    this.sent++;
    const other = this.other;
    const generation = this.generation;
    const otherGeneration = other.generation;
    queueMicrotask(() => {
      if (
        this.online &&
        other.online &&
        this.generation === generation &&
        other.generation === otherGeneration
      )
        other.emit("message", structuredClone(message));
    });
  }
}

/** Event-driven condition, with a failure timeout rather than a timing assertion. */
export function documentMatches<T>(
  handle: DocHandle<T>,
  matches: (doc: T) => boolean,
): Promise<void> {
  if (handle.isReady() && matches(handle.doc())) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      handle.off("change", onChange);
      if (error) reject(error);
      else resolve();
    };
    const onChange = () => {
      if (matches(handle.doc())) finish();
    };
    const timer = setTimeout(
      () =>
        finish(new Error("Document did not reach the expected synced state")),
      2500,
    );
    handle.on("change", onChange);
  });
}
