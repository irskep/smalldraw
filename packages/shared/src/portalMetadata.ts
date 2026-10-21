const ORIGIN = "https://splatterboard.app";
const DESCRIPTION =
  "A free drawing app for kids. Draw, paint, and play with stamps. No ads, no gimmicks.";

const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Splatterboard — A free drawing app for kids",
    description: DESCRIPTION,
  },
  "/data": {
    title: "How your drawings are stored — Splatterboard",
    description:
      "Learn how Splatterboard saves drawings on your device, syncs them to your account, and keeps shared drawings available.",
  },
  "/privacy": {
    title: "Privacy policy — Splatterboard",
    description: "How Splatterboard handles your information and drawings.",
  },
  "/terms": {
    title: "Terms of service — Splatterboard",
    description: "Terms of service for using Splatterboard.",
  },
};

export interface MetadataElement {
  tag: "meta" | "link" | "script";
  attributes: Record<string, string>;
  text?: string;
}

/** Shared by the initial HTML response and client-side route changes. */
export function getPortalMetadata(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const page = PUBLIC_PAGES[path];
  const elements: MetadataElement[] = [];
  const meta = (name: string, content: string) =>
    elements.push({ tag: "meta", attributes: { name, content } });
  const og = (property: string, content: string) =>
    elements.push({ tag: "meta", attributes: { property, content } });
  meta(
    "robots",
    page ? "index, follow, max-image-preview:large" : "noindex, follow",
  );
  if (!page) return { title: "Splatterboard", elements };
  const url = `${ORIGIN}${path}`;
  meta("description", page.description);
  elements.push({ tag: "link", attributes: { rel: "canonical", href: url } });
  og("og:type", "website");
  og("og:site_name", "Splatterboard");
  og("og:locale", "en_US");
  og("og:title", page.title);
  og("og:description", page.description);
  og("og:url", url);
  og("og:image", `${ORIGIN}/drawing-preview.png`);
  og("og:image:type", "image/png");
  og("og:image:width", "1280");
  og("og:image:height", "800");
  const alt =
    "Splatterboard drawing tools around a rainbow, a purple cat, and a yellow sun.";
  og("og:image:alt", alt);
  meta("twitter:card", "summary_large_image");
  meta("twitter:title", page.title);
  meta("twitter:description", page.description);
  meta("twitter:image", `${ORIGIN}/drawing-preview.png`);
  meta("twitter:image:alt", alt);
  if (path === "/")
    elements.push({
      tag: "script",
      attributes: { type: "application/ld+json" },
      text: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${ORIGIN}/#website`,
            name: "Splatterboard",
            url: `${ORIGIN}/`,
            inLanguage: "en",
          },
          {
            "@type": "WebApplication",
            name: "Splatterboard",
            url: `${ORIGIN}/`,
            description: DESCRIPTION,
            applicationCategory: "DesignApplication",
            operatingSystem: "Any",
            isAccessibleForFree: true,
            screenshot: `${ORIGIN}/drawing-preview.png`,
          },
        ],
      }),
    });
  return { title: page.title, elements };
}
