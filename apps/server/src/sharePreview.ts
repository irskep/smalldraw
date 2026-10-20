import { buildDrawingAppUrl } from "@smalldraw/shared";
import { getDocumentInvitationByToken } from "./db/getDocumentInvitationByToken.js";
import { getDocumentThumbnail } from "./db/getDocumentThumbnail.js";
import { buildDocumentThumbnailUrl } from "./db/thumbnailStorage.js";

export interface SharePreview {
  url: string;
  image: string;
  imageType: string;
}

/** Read-only: a crawler must not create a device token or join the drawing. */
export async function getSharePreview(
  token: string,
  origin: string,
): Promise<SharePreview | null> {
  const invitation = await getDocumentInvitationByToken(token, {
    scopes: ["share"],
  });
  if (!invitation) return null;
  const thumbnail = await getDocumentThumbnail(invitation.documentId);
  if (!thumbnail) return null;
  const image = buildDocumentThumbnailUrl(
    thumbnail.storageKey,
    process.env.R2_PUBLIC_BASE_URL,
  );
  if (!image) return null;
  return {
    url: buildDrawingAppUrl(origin, { type: "join", joinSecret: token }),
    image,
    imageType: thumbnail.contentType,
  };
}

export function renderSharePreview(
  html: string,
  preview: SharePreview,
): string {
  const escape = Bun.escapeHTML;
  const title = "Drawing – Splatterboard";
  const metadata = `
    <link rel="canonical" href="${escape(preview.url)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Splatterboard">
    <meta property="og:title" content="${title}">
    <meta property="og:url" content="${escape(preview.url)}">
    <meta property="og:image" content="${escape(preview.image)}">
    <meta property="og:image:type" content="${escape(preview.imageType)}">
    <meta property="og:image:alt" content="Shared drawing">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:image" content="${escape(preview.image)}">
    <meta name="twitter:image:alt" content="Shared drawing">
  `;
  return html
    .replace(/<meta\b[^>]*(?:property=["']og:|name=["']twitter:)[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
    .replace(/<\/head>/i, `${metadata}</head>`);
}
