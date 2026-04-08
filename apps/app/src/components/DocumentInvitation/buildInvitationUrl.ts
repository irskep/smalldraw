export const buildInvitationUrl = (
  token: string | null | undefined,
  origin = window.location.origin,
): string => `${origin}/invitation/${token ?? ""}`;
