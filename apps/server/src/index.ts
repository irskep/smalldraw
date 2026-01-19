import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as trpcExpress from "@trpc/server/adapters/express";
import cors, { CorsOptions } from "cors";
import express from "express";
import { webSocketServer } from "./automergeRepo/automergeRepo.js";
import { getSession } from "./db/getSession.js";
import { appRouter } from "./trpc/appRouter.js";
import { createContext } from "./trpc/trpc.js";

if (!process.env.OPAQUE_SERVER_SETUP) {
  throw new Error("OPAQUE_SERVER_SETUP is missing");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const staticDir = path.resolve(serverRoot, "public");
const indexHtmlPath = path.join(staticDir, "index.html");

const PORT = process.env.PORT !== undefined ? parseInt(process.env.PORT) : 3030;
const app = express();

app.use(express.json());

const allowedOrigin =
  process.env.NODE_ENV === "production"
    ? (process.env.FRONTEND_ORIGIN ?? "https://automerge-jumpstart.vercel.app")
    : "http://localhost:5100";

const corsOptions: CorsOptions = {
  origin: allowedOrigin,
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
  if (origin && origin !== allowedOrigin) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  let sessionKey: null | string = null;
  const queryStartPos = (request.url || "").indexOf("?");
  if (queryStartPos !== -1) {
    const queryString = request.url?.slice(queryStartPos + 1);
    const queryParameters = new URLSearchParams(queryString);
    sessionKey = queryParameters.get("sessionKey");
  }

  if (!sessionKey) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const session = await getSession(sessionKey);
  if (!session) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (currentSocket) => {
    // @ts-expect-error adding the session to the socket so we can access it in the network adapter
    currentSocket.session = session;
    webSocketServer.emit("connection", currentSocket, request);
  });
});
