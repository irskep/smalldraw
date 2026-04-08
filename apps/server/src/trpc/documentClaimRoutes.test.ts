import { describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";
import { createAnonymousCollaborativeDocument } from "../db/createAnonymousCollaborativeDocument.js";
import { createUser } from "../db/createUser.js";
import { appRouter } from "./appRouter.js";

describe("document claim routes", () => {
  it("rejects anonymous claim attempts", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: null,
    });

    await expect(
      caller.claimCollaborativeDocument({ accessToken: "owner-token" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("allows authenticated owner-token claims", async () => {
    const user = await createUser({
      username: "claim-route-user",
      registrationRecord: "registration-record",
    });
    const created = await createAnonymousCollaborativeDocument({
      documentId: "claim-route-doc",
      ownerTag: "route-device",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "session-key",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(
      caller.claimCollaborativeDocument({ accessToken: created.accessToken }),
    ).resolves.toEqual({
      documentId: "claim-route-doc",
      attached: true,
      isAdmin: true,
    });
  });
});
