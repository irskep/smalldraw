export const SHARE_PARTICIPANT_LIMIT = 10;
export const SHARE_LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type ShareAvailability =
  | "open"
  | "expired"
  | "closed"
  | "full"
  | "blocked_referral"
  | "unavailable";
export interface ShareInspection {
  documentId: string;
  availability: ShareAvailability;
  existingParticipant: boolean;
  thumbnailUrl: string | null;
}
export interface ShareSettings {
  token: string;
  expiresAt: string;
  allowNewJoiners: boolean;
  participantCount: number;
  participantLimit: number;
}
export interface ShareAdmissionProof {
  accessToken?: string;
  admissionKey?: string;
  navigationReferrer?: string;
}
export function isBlockedShareReferrer(referrer: string | undefined): boolean {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/\.$/, "");
    return (
      host === "news.ycombinator.com" ||
      host === "reddit.com" ||
      host.endsWith(".reddit.com") ||
      host === "redd.it" ||
      host.endsWith(".redd.it")
    );
  } catch {
    return false;
  }
}

export function shareAvailabilityMessage(
  availability: ShareAvailability,
): string {
  switch (availability) {
    case "open":
      return "Join this drawing";
    case "expired":
      return "This invitation has expired. Ask the owner for a new link.";
    case "closed":
      return "The owner has stopped new people from joining.";
    case "full":
      return "This drawing already has 10 participants.";
    case "blocked_referral":
      return "Drawing invitations are for small groups, not public posts on Hacker News or Reddit.";
    case "unavailable":
      return "This invitation is no longer available.";
  }
}
