import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { documentInvitations, documents } from "./schema.js";

type Params = {
  documentId: string;
  name?: string;
};

export const createAnonymousCollaborativeDocument = async ({
  documentId,
  name,
}: Params) => {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [document] = await tx
      .insert(documents)
      .values({
        id: documentId,
        name: name ?? "Untitled",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [invitation] = await tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(16),
        createdAt: now,
      })
      .returning();

    return {
      document,
      joinSecret: invitation.token,
    };
  });
};
