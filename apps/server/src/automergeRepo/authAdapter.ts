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

    super.receiveMessage(messageBytes, socket);
  }
}
