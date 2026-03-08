import type { SocketAuthContext } from "./socketAuthContext.js";

type AwarenessPayload = {
  type?: unknown;
  userId?: unknown;
};

export const isValidAwarenessPayloadForAuth = (
  authContext: SocketAuthContext,
  payload: AwarenessPayload,
) => {
  if (payload.type !== "awareness") return false;
  if (authContext.kind === "token") return true;
  return payload.userId === authContext.userId;
};
