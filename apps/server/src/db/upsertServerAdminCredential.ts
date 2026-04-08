import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { serverAdminCredentials, users } from "./schema.js";

export const upsertServerAdminCredential = async ({
  userId,
  password,
}: {
  userId: string;
  password: string;
}) => {
  const now = new Date();
  const passwordHash = await Bun.password.hash(password);

  await db
    .update(users)
    .set({ isServerAdmin: true })
    .where(eq(users.id, userId));

  await db
    .insert(serverAdminCredentials)
    .values({
      userId,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: serverAdminCredentials.userId,
      set: {
        passwordHash,
        updatedAt: now,
      },
    });
};
