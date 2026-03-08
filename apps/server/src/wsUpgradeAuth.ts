import type { SocketAuthContext } from "./automergeRepo/socketAuthContext.js";
import type { DocumentInvitation } from "./db/schema.js";

type Session = {
  userId: string;
};

type ResolveWebSocketUpgradeAuthParams = {
  requestUrl: string | undefined;
  getSessionByKey: (sessionKey: string) => Promise<Session | null>;
  getInvitationByToken: (token: string) => Promise<DocumentInvitation | null>;
};

export const resolveWebSocketUpgradeAuth = async ({
  requestUrl,
  getSessionByKey,
  getInvitationByToken,
}: ResolveWebSocketUpgradeAuthParams): Promise<SocketAuthContext | null> => {
  const queryStringIndex = (requestUrl ?? "").indexOf("?");
  if (queryStringIndex === -1) return null;

  const queryString = requestUrl?.slice(queryStringIndex + 1) ?? "";
  const query = new URLSearchParams(queryString);

  const token = query.get("token");
  if (token) {
    const invitation = await getInvitationByToken(token);
    if (!invitation) return null;
    return {
      kind: "token",
      documentId: invitation.documentId,
    };
  }

  const sessionKey = query.get("sessionKey");
  if (!sessionKey) return null;

  const session = await getSessionByKey(sessionKey);
  if (!session) return null;
  return {
    kind: "session",
    userId: session.userId,
  };
};
