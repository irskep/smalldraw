import { getPortalMetadata } from "@smalldraw/shared";

export function renderPortalMetadata(html: string, pathname: string): string {
  const { title, elements } = getPortalMetadata(pathname);
  const tags = elements
    .map(({ tag, attributes, text }) => {
      const attrs = Object.entries(attributes)
        .map(([key, value]) => `${key}="${Bun.escapeHTML(value)}"`)
        .join(" ");
      return tag === "script"
        ? `<script data-portal-metadata ${attrs}>${text?.replaceAll("<", "\\u003c")}</script>`
        : `<${tag} data-portal-metadata ${attrs}>`;
    })
    .join("\n");
  return html
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, "")
    .replace(
      /<title>[^<]*<\/title>/i,
      `<title>${Bun.escapeHTML(title)}</title>`,
    )
    .replace("</head>", `${tags}\n</head>`);
}
