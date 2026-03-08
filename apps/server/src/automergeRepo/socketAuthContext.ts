import type WebSocket from "isomorphic-ws";

export type SessionAuthContext = {
  kind: "session";
  userId: string;
};

export type TokenAuthContext = {
  kind: "token";
  documentId: string;
};

export type SocketAuthContext = SessionAuthContext | TokenAuthContext;

export type AuthenticatedSocket = WebSocket & {
  authContext?: SocketAuthContext;
};

export const getSocketAuthContext = (
  socket: WebSocket,
): SocketAuthContext | null => {
  const context = (socket as AuthenticatedSocket).authContext;
  return context ?? null;
};
