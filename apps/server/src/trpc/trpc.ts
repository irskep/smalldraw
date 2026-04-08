import { initTRPC, TRPCError } from "@trpc/server";
import type * as trpcExpress from "@trpc/server/adapters/express";
import { getServerAdminByBasicAuth } from "../db/getServerAdminByBasicAuth.js";
import { getSession } from "../db/getSession.js";

// created for each request
export const createContext = async ({
  req,
}: trpcExpress.CreateExpressContextOptions) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Basic ")) {
    const serverAdmin = await getServerAdminByBasicAuth(authorization);
    return { session: null, serverAdmin };
  }

  if (authorization) {
    const session = await getSession(authorization);
    return { session, serverAdmin: null };
  }

  return { session: null, serverAdmin: null };
};

type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(
  async function isAuthenticated(opts) {
    const { ctx } = opts;
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return opts.next({
      ctx: {
        session: ctx.session,
      },
    });
  },
);
export const serverAdminProcedure = t.procedure.use(
  async function isServerAdmin(opts) {
    const { ctx } = opts;
    if (!ctx.serverAdmin) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return opts.next({
      ctx: {
        serverAdmin: ctx.serverAdmin,
      },
    });
  },
);
