import { cbor as cborHelpers } from "@automerge/automerge-repo";
import {
  type FromClientMessage,
  NodeWSServerAdapter,
} from "@automerge/automerge-repo-network-websocket";
import type WebSocket from "isomorphic-ws";
import { getUserHasAccessToDocument } from "../db/getUserHasAccessToDocument.js";
import { isValidAwarenessPayloadForAuth } from "./awarenessValidation.js";
import { getSocketAuthContext } from "./socketAuthContext.js";

const { decode } = cborHelpers;

export class AuthAdapter extends NodeWSServerAdapter {
  async receiveMessage(messageBytes: Uint8Array, socket: WebSocket) {
    const message: FromClientMessage = decode(messageBytes);
    const authContext = getSocketAuthContext(socket);
    if (!authContext) return;

    if ("documentId" in message) {
      const messageDocumentId = message.documentId as string;
      if (authContext.kind === "session") {
        const hasAccess = await getUserHasAccessToDocument({
          userId: authContext.userId,
          documentId: messageDocumentId,
        });
        if (!hasAccess) return;
      } else if (messageDocumentId !== authContext.documentId) {
        return;
      }

      // check for invalid awareness messages
      if (message.type === "ephemeral" && message.data) {
        const data = decode(message.data) as {
          type?: unknown;
          userId?: unknown;
        };
        if (!isValidAwarenessPayloadForAuth(authContext, data)) return;
      }
    }

    super.receiveMessage(messageBytes, socket);
  }
}
