import { getActiveDocumentTokenByToken } from "./documentTokens.js";
import type { DocumentTokenScope } from "./schema.js";

export const getDocumentInvitationByToken = async (
  token: string,
  options?: { scopes?: readonly DocumentTokenScope[] },
) => {
  return await getActiveDocumentTokenByToken({
    token,
    scopes: options?.scopes,
  });
};
