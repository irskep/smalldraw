import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as trpcExpress from "@trpc/server/adapters/express";
import cors, { type CorsOptions } from "cors";
import express from "express";
import { webSocketServer } from "./automergeRepo/automergeRepo.js";
import type { AuthenticatedSocket } from "./automergeRepo/socketAuthContext.js";
import { touchDocumentToken } from "./db/documentTokens.js";
import { getDocumentInvitationByToken } from "./db/getDocumentInvitationByToken.js";
import { getSession } from "./db/getSession.js";
import { appRouter } from "./trpc/appRouter.js";
import { createContext } from "./trpc/trpc.js";
import { resolveWebSocketUpgradeAuth } from "./wsUpgradeAuth.js";

if (!process.env.OPAQUE_SERVER_SETUP) {
  throw new Error("OPAQUE_SERVER_SETUP is missing");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const staticDir = path.resolve(serverRoot, "public");
const indexHtmlPath = path.join(staticDir, "index.html");

const PORT =
  process.env.PORT !== undefined ? parseInt(process.env.PORT, 10) : 3030;
const app = express();

app.use(express.json());

const defaultAllowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://splatterboard.app"]
    : ["http://localhost:3000"];
const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const finalAllowedOrigins =
  allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

const corsOptions: CorsOptions = {
  origin: finalAllowedOrigins,
  credentials: true,
};

app.use(cors(corsOptions));

app.use(
  "/api",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use(express.static(staticDir, { index: false }));

app.get("/healthz", (_req, res) => {
  res.send("ok");
});

app.get("*", (req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    return next();
  }

  if (!fs.existsSync(indexHtmlPath)) {
    return res.status(404).send("Frontend build not found");
  }

  res.sendFile(indexHtmlPath);
});

const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

server.on("upgrade", async (request, socket, head) => {
  const origin = request.headers.origin;
  if (origin && !finalAllowedOrigins.includes(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  const authContext = await resolveWebSocketUpgradeAuth({
    requestUrl: request.url,
    getSessionByKey: getSession,
    getInvitationByToken: (token) =>
      getDocumentInvitationByToken(token, { scopes: ["owner", "device"] }),
  });
  if (!authContext) {
    console.warn("[server:ws-upgrade] unauthorized upgrade rejected", {
      url: request.url,
      origin,
    });
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  console.info("[server:ws-upgrade] authenticated websocket upgrade", {
    url: request.url,
    authKind: authContext.kind,
    documentId: authContext.kind === "token" ? authContext.documentId : null,
    tokenScope: authContext.kind === "token" ? authContext.scope : null,
    tokenTag: authContext.kind === "token" ? authContext.tag : null,
  });
  if (authContext.kind === "token") {
    void touchDocumentToken({ tokenId: authContext.tokenId });
  }

  webSocketServer.handleUpgrade(request, socket, head, (currentSocket) => {
    (currentSocket as AuthenticatedSocket).authContext = authContext;
    webSocketServer.emit("connection", currentSocket, request);
  });
});
