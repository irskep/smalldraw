import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isPortalRoutePath } from "@smalldraw/shared";
import * as trpcExpress from "@trpc/server/adapters/express";
import cors, { type CorsOptions } from "cors";
import express from "express";

import {
  repo,
  repoStorage,
  shutdownRepository,
  stopRepositoryNetwork,
  webSocketServer,
} from "./automergeRepo/automergeRepo.js";
import type { AuthenticatedSocket } from "./automergeRepo/socketAuthContext.js";
import { checkAccountStorage } from "./db/client.js";
import { touchDocumentToken } from "./db/documentTokens.js";
import { getDocumentInvitationByToken } from "./db/getDocumentInvitationByToken.js";
import { getSession } from "./db/getSession.js";
import { startMetrics } from "./metrics.js";
import { renderPortalMetadata } from "./portalMetadata.js";
import { ServerLifecycle } from "./runtime.js";
import { getSharePreview, renderSharePreview } from "./sharePreview.js";
import { getR2ThumbnailConfig } from "./storage/documentThumbnailStore.js";
import { appRouter } from "./trpc/appRouter.js";
import { createDocumentTransferHttp } from "./trpc/documentTransferHttp.js";
import { createContext } from "./trpc/trpc.js";
import { serverTrace } from "./utils/serverTrace.js";
import { resolveWebSocketUpgradeAuth } from "./wsUpgradeAuth.js";

if (!process.env.OPAQUE_SERVER_SETUP) {
  throw new Error("OPAQUE_SERVER_SETUP is missing");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..", "..");
const staticDir = path.resolve(serverRoot, "build");
const sourceColoringDir = path.resolve(
  repoRoot,
  "packages/splat/src/coloring/assets",
);
const indexHtmlPath = path.join(staticDir, "index.html");
const drawIndexHtmlPath = path.join(staticDir, "draw.html");

const PORT =
  process.env.PORT !== undefined ? parseInt(process.env.PORT, 10) : 3030;
const app = express();
const lifecycle = new ServerLifecycle();
app.use((_req, res, next) => {
  if (!lifecycle.ready) {
    res.set("Connection", "close").status(503).send("not ready");
    return;
  }
  lifecycle.trackResponse(res);
  next();
});

// Fail startup before listening if migrations or deployed entry points are missing.
checkAccountStorage();
repoStorage.checkReady();
if (process.env.NODE_ENV === "production") {
  fs.accessSync(indexHtmlPath, fs.constants.R_OK);
  fs.accessSync(drawIndexHtmlPath, fs.constants.R_OK);
}
const metricsServer = process.env.METRICS_PORT
  ? startMetrics(Number(process.env.METRICS_PORT), () => ({
      residentDocuments: Object.keys(repo.handles).length,
      sockets: webSocketServer.clients.size,
    }))
  : undefined;

// Image uploads remain JSON; document snapshots use the binary endpoint below.
app.use(express.json({ limit: "16mb" }));

const defaultAllowedOrigins: string[] = [];
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
app.use("/api/v1/documents", createDocumentTransferHttp());

app.use(
  "/api/v1",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/index.html", (_req, res) => res.redirect(301, "/"));
app.use(
  express.static(staticDir, {
    index: false,
    setHeaders(res, filePath) {
      if (/[/\\]engine[/\\]automerge-[a-f0-9]{16}\.wasm$/.test(filePath))
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }),
);
if (fs.existsSync(sourceColoringDir)) {
  app.use("/coloring", express.static(sourceColoringDir, { index: false }));
}

app.get("/healthz", (_req, res) => {
  res.send("ok");
});

// SPA fallback only for known app routes
app.get("/draw/*", async (req, res, next) => {
  res.set("X-Robots-Tag", "noindex, follow");
  if (!fs.existsSync(drawIndexHtmlPath)) {
    return res.status(404).send("Drawing app build not found");
  }
  try {
    if (typeof req.query.join === "string") {
      const protocol =
        req.get("x-forwarded-proto") === "https" ? "https" : req.protocol;
      const preview = await getSharePreview(
        req.query.join,
        `${protocol}://${req.get("host")}`,
      );
      if (preview) {
        res.set("Cache-Control", "no-store");
        return res
          .type("html")
          .send(
            renderSharePreview(
              await fs.promises.readFile(drawIndexHtmlPath, "utf8"),
              preview,
            ),
          );
      }
    }
    res.sendFile(drawIndexHtmlPath);
  } catch (error) {
    next(error);
  }
});

let portalTemplate: string | undefined;

app.get("*", (req, res, next) => {
  if (!isPortalRoutePath(req.path)) {
    next();
    return;
  }
  if (!fs.existsSync(indexHtmlPath)) {
    return res.status(404).send("Portal app build not found");
  }
  portalTemplate ??= fs.readFileSync(indexHtmlPath, "utf8");
  res.type("html").send(renderPortalMetadata(portalTemplate, req.path));
});

const server = app.listen(PORT, () => {
  lifecycle.ready = true;
  console.log(`Listening on port ${PORT}`);
  const r2ThumbnailConfig = getR2ThumbnailConfig();
  if (!r2ThumbnailConfig.ready || !r2ThumbnailConfig.publicBaseUrl) {
    console.warn("[server:thumbnails] R2 config incomplete", {
      missing: [
        ...r2ThumbnailConfig.missing,
        r2ThumbnailConfig.publicBaseUrl ? null : "R2_PUBLIC_BASE_URL",
      ].filter((name): name is string => Boolean(name)),
    });
  }
});

server.on("upgrade", async (request, socket, head) => {
  if (lifecycle.draining) {
    socket.destroy();
    return;
  }
  const origin = request.headers.origin;
  if (origin) {
    const originHost = new URL(origin).host;
    const isSameOrigin = originHost === request.headers.host;
    if (!isSameOrigin && !finalAllowedOrigins.includes(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
  }

  const authContext = await resolveWebSocketUpgradeAuth({
    requestUrl: request.url,
    getSessionByKey: getSession,
    getInvitationByToken: (token) =>
      getDocumentInvitationByToken(token, { scopes: ["owner", "device"] }),
  });
  if (lifecycle.draining || socket.destroyed) {
    socket.destroy();
    return;
  }
  if (!authContext) {
    console.warn("[server:ws-upgrade] unauthorized upgrade rejected", {
      url: request.url,
      origin,
    });
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  serverTrace("[server:ws-upgrade] authenticated websocket upgrade", {
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

function shutdown(signal: string) {
  if (lifecycle.draining) return;
  console.log("[server:shutdown] draining", { signal });
  // Leave two seconds before Fly's kill timeout; never claim a timed-out flush succeeded.
  const deadline = setTimeout(() => {
    console.error("[server:shutdown] drain timed out");
    process.exit(1);
  }, 18_000);
  void lifecycle
    .drain(server, stopRepositoryNetwork, shutdownRepository)
    .then(() => {
      metricsServer?.close();
      clearTimeout(deadline);
      console.log("[server:shutdown] flushed and stopped");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[server:shutdown] failed", error);
      process.exit(1);
    });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
