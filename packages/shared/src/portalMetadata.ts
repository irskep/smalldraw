import { getColoringTopic } from "./coloringTopics";

const ORIGIN = "https://splatterboard.app";
const DESCRIPTION =
  "A free drawing app for kids. Draw, paint, and play with stamps. No ads, no gimmicks.";

const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Splatterboard — A free drawing app for kids",
    description: DESCRIPTION,
  },
  "/coloringbook": {
    title: "Free coloring book — Splatterboard",
    description:
      "Pick a picture and start coloring. Explore animals, dinosaurs, butterflies, and more in Splatterboard’s free coloring book app. No ads or signup required.",
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
  const topic = getColoringTopic(path);
  const page = topic
    ? {
        title:
          topic.id === "public-domain-review"
            ? `${topic.heading} — Splatterboard`
            : `Free ${topic.heading.charAt(0).toLowerCase()}${topic.heading.slice(1)} — Splatterboard`,
        description: topic.description,
      }
    : PUBLIC_PAGES[path];
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
  const coloringBook = path === "/coloringbook" || Boolean(topic);
  const preview = `${ORIGIN}/${coloringBook ? "coloringbook-preview.png" : "drawing-preview.png"}`;
  og("og:image", preview);
  og("og:image:type", "image/png");
  og("og:image:width", coloringBook ? "2200" : "1280");
  og("og:image:height", coloringBook ? "1520" : "800");
  const alt = coloringBook
    ? "Splatterboard’s coloring tools and palette beside a green frog on a yellow background."
    : "Splatterboard drawing tools around a rainbow, a purple cat, and a yellow sun.";
  og("og:image:alt", alt);
  meta("twitter:card", "summary_large_image");
  meta("twitter:title", page.title);
  meta("twitter:description", page.description);
  meta("twitter:image", preview);
  meta("twitter:image:alt", alt);
  if (topic)
    elements.push({
      tag: "script",
      attributes: { type: "application/ld+json" },
      text: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: topic.heading,
            description: topic.description,
            url,
            isAccessibleForFree: true,
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Coloring book",
                item: `${ORIGIN}/coloringbook`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: topic.title,
                item: url,
              },
            ],
          },
        ],
      }),
    });
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
