import { cbor } from "@automerge/automerge-repo";
import { getAppError } from "@smalldraw/shared";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import express from "express";

import { documentTransferRouter } from "./appRouter.js";
import { createContext } from "./trpc.js";

/** Binary envelopes carry snapshot bytes and credentials together, without base64 copies. */
export function createDocumentTransferHttp() {
  const router = express.Router();
  router.use(express.raw({ type: "application/cbor", limit: "16mb" }));
  router.post("/:operation", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const operation = req.params.operation;
      if (!Object.hasOwn(documentTransferRouter._def.procedures, operation))
        throw new TRPCError({ code: "NOT_FOUND" });
      if (!req.is("application/cbor") || !Buffer.isBuffer(req.body))
        throw new TRPCError({ code: "UNSUPPORTED_MEDIA_TYPE" });
      let input: unknown;
      try {
        input = cbor.decode(req.body);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid binary request",
        });
      }
      const caller = documentTransferRouter.createCaller(
        await createContext({ req, res }),
      );
      const result = await caller[operation as keyof typeof caller](
        input as never,
      );
      res.type("application/cbor").send(Buffer.from(cbor.encode({ result })));
    } catch (cause) {
      const error =
        cause instanceof TRPCError
          ? cause
          : new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause });
      const httpStatus = getHTTPStatusCodeFromError(error);
      res
        .status(httpStatus)
        .type("application/cbor")
        .send(
          Buffer.from(
            cbor.encode({
              error: {
                message: error.message,
                code: -32603,
                data: {
                  code: error.code,
                  httpStatus,
                  appError: getAppError(error.cause),
                },
              },
            }),
          ),
        );
    }
  });
  return router;
}
