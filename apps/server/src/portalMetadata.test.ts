import { expect, test } from "bun:test";

import { COLORING_TOPICS, getPortalMetadata } from "@smalldraw/shared";

import { renderPortalMetadata } from "./portalMetadata";

const shell =
  '<html><head><title>Splatterboard</title><meta name="description" content="Old"></head><body><div id="root"></div></body></html>';

test("landing metadata is present before JavaScript, with one canonical and description", () => {
  const html = renderPortalMetadata(shell, "/");
  expect(html).toContain("Splatterboard — A free drawing app for kids");
  expect(html.match(/name="description"/g)).toHaveLength(1);
  expect(html.match(/rel="canonical"/g)).toHaveLength(1);
  expect(html).toContain('href="https://splatterboard.app/"');
  expect(html).toContain(
    'property="og:image" content="https://splatterboard.app/drawing-preview.png"',
  );
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  const json = html.match(/<script[^>]+>(.*?)<\/script>/s)?.[1];
  expect(
    JSON.parse(json!)["@graph"].map(
      (item: { "@type": string }) => item["@type"],
    ),
  ).toEqual(["WebSite", "WebApplication"]);
  expect(html).toContain('<body><div id="root"></div></body>');
});

test("other routes do not inherit homepage canonical or structured data", () => {
  for (const path of [
    "/account",
    "/login",
    "/register",
    "/invitation/secret",
  ]) {
    const html = renderPortalMetadata(shell, path);
    expect(html).toContain('content="noindex, follow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("secret");
  }
  const data = renderPortalMetadata(shell, "/data/");
  expect(data).toContain('href="https://splatterboard.app/data"');
  expect(data).not.toContain("application/ld+json");
});

test("every coloring topic has distinct initial metadata and a sitemap URL", async () => {
  const sitemap = await Bun.file(
    new URL("../../app/public/sitemap.xml", import.meta.url),
  ).text();
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const topic of COLORING_TOPICS) {
    const path = `/coloringbook/${topic.id}`;
    const html = renderPortalMetadata(shell, `${path}/`);
    expect(html).toContain(`href="https://splatterboard.app${path}"`);
    expect(html).toContain(
      `property="og:url" content="https://splatterboard.app${path}"`,
    );
    expect(html).toContain('content="index, follow, max-image-preview:large"');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(sitemap).toContain(`<loc>https://splatterboard.app${path}</loc>`);
    titles.add(getPortalMetadata(path).title);
    descriptions.add(topic.description);
  }
  expect(titles.size).toBe(COLORING_TOPICS.length);
  expect(descriptions.size).toBe(COLORING_TOPICS.length);
  expect(renderPortalMetadata(shell, "/coloringbook/not-a-topic")).toContain(
    'content="noindex, follow"',
  );
});
