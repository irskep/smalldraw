import type { DocumentId } from "@automerge/automerge-repo";
import { cbor as cborHelpers } from "@automerge/automerge-repo";
import {
  type FromClientMessage,
  NodeWSServerAdapter,
} from "@automerge/automerge-repo-network-websocket";
import type WebSocket from "isomorphic-ws";
import { getUserHasAccessToDocument } from "../db/getUserHasAccessToDocument.js";
import { isValidAwarenessPayloadForAuth } from "./awarenessValidation.js";
import type { DocumentLifetime } from "./documentLifetime.js";
import { getSocketAuthContext } from "./socketAuthContext.js";

const { decode } = cborHelpers;

export class AuthAdapter extends NodeWSServerAdapter {
  documentLifetime?: DocumentLifetime;
  private socketPins = new WeakMap<
    WebSocket,
    Map<string, Promise<() => void>>
  >();
  async receiveMessage(messageBytes: Uint8Array, socket: WebSocket) {
    const message: FromClientMessage = decode(messageBytes);
    const authContext = getSocketAuthContext(socket);
    if (!authContext) {
      console.warn("[server:automerge-auth] missing auth context; dropping");
      return;
    }

    if ("documentId" in message) {
      const messageDocumentId = message.documentId as string;
      if (authContext.kind === "session") {
        const hasAccess = await getUserHasAccessToDocument({
          userId: authContext.userId,
          documentId: messageDocumentId,
        });
        if (!hasAccess) {
          console.warn("[server:automerge-auth] session access denied", {
            userId: authContext.userId,
            messageDocumentId,
            messageType: message.type,
          });
          return;
        }
      } else if (messageDocumentId !== authContext.documentId) {
        console.warn("[server:automerge-auth] token document mismatch", {
          messageDocumentId,
          allowedDocumentId: authContext.documentId,
          messageType: message.type,
        });
        return;
      }
      console.info("[server:automerge-auth] message accepted", {
        authKind: authContext.kind,
        messageType: message.type,
        messageDocumentId,
        tokenScope: authContext.kind === "token" ? authContext.scope : null,
        tokenTag: authContext.kind === "token" ? authContext.tag : null,
      });

      // check for invalid awareness messages
      if (message.type === "ephemeral" && message.data) {
        const data = decode(message.data) as {
          type?: unknown;
          userId?: unknown;
        };
        if (!isValidAwarenessPayloadForAuth(authContext, data)) {
          console.warn("[server:automerge-auth] invalid awareness payload", {
            authKind: authContext.kind,
            messageDocumentId,
          });
          return;
        }
      }
    }

    if ("documentId" in message && this.documentLifetime) {
      let pins = this.socketPins.get(socket);
      if (!pins) {
        pins = new Map();
        this.socketPins.set(socket, pins);
        const socketPins = pins;
        socket.once("close", () => {
          for (const pin of socketPins.values())
            void pin.then((release) => release());
          socketPins.clear();
        });
      }
      const id = message.documentId as DocumentId;
      let pin = pins.get(id);
      if (!pin) {
        pin = this.documentLifetime.acquire(id);
        pins.set(id, pin);
      }
      const release = await pin;
      if (socket.readyState !== socket.OPEN) {
        release();
        pins.delete(id);
        return;
      }
    }
    super.receiveMessage(messageBytes, socket);
  }
}
