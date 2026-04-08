import { initTRPC, TRPCError } from "@trpc/server";
import type * as trpcExpress from "@trpc/server/adapters/express";
import { parseSessionKeyFromCookieHeader } from "../auth/sessionCookie.js";
import { getServerAdminByBasicAuth } from "../db/getServerAdminByBasicAuth.js";
import { getSession } from "../db/getSession.js";

// created for each request
export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Basic ")) {
    const serverAdmin = await getServerAdminByBasicAuth(authorization);
    return { req, res, session: null, serverAdmin };
  }

  const sessionKeyFromCookie = parseSessionKeyFromCookieHeader(
    req.headers.cookie,
  );
  if (sessionKeyFromCookie) {
    const session = await getSession(sessionKeyFromCookie);
    return { req, res, session, serverAdmin: null };
  }

  if (authorization) {
    const session = await getSession(authorization);
    return { req, res, session, serverAdmin: null };
  }

  return { req, res, session: null, serverAdmin: null };
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
        ...ctx,
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
        ...ctx,
        serverAdmin: ctx.serverAdmin,
      },
    });
  },
);
