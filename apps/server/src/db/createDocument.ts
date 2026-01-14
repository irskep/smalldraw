import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import {
  documentInvitations,
  documents,
  usersOnDocuments,
} from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
  name?: string;
};

export const createDocument = async ({ userId, documentId, name }: Params) => {
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

    await tx
      .insert(usersOnDocuments)
      .values({ userId, documentId, isAdmin: true });

    await tx.insert(documentInvitations).values({
      documentId,
      token: generateId(16),
      createdAt: now,
    });

    return document;
  });
};
