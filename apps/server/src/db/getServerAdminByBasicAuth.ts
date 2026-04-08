import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { serverAdminCredentials, users } from "./schema.js";

const decodeBasicAuth = (
  authorizationHeader: string,
): { username: string; password: string } | null => {
  if (!authorizationHeader.startsWith("Basic ")) {
    return null;
  }
  const encoded = authorizationHeader.slice("Basic ".length).trim();
  if (encoded.length === 0) {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
};

export const getServerAdminByBasicAuth = async (
  authorizationHeader: string | undefined,
) => {
  if (!authorizationHeader) {
    return null;
  }
  const decoded = decodeBasicAuth(authorizationHeader);
  if (!decoded) {
    return null;
  }

  const [credential] = await db
    .select({
      id: users.id,
      username: users.username,
      isServerAdmin: users.isServerAdmin,
      passwordHash: serverAdminCredentials.passwordHash,
    })
    .from(users)
    .innerJoin(
      serverAdminCredentials,
      eq(serverAdminCredentials.userId, users.id),
    )
    .where(
      and(eq(users.username, decoded.username), eq(users.isServerAdmin, true)),
    )
    .limit(1);

  if (!credential) {
    return null;
  }

  const matches = await Bun.password.verify(
    decoded.password,
    credential.passwordHash,
  );
  if (!matches) {
    return null;
  }

  return {
    id: credential.id,
    username: credential.username,
  };
};
