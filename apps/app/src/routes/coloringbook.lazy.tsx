import { getColoringCategories } from "@smalldraw/splat/coloring";
import { Dice5 } from "lucide";
import { useState } from "preact/hooks";

import { Icon } from "../components/Icon";
import { appPath } from "../config";
import {
  buildNewDrawingUrl,
  type AccountWebRuntimeConfig,
} from "../utils/drawingAppLinks";

const categories = getColoringCategories();
const assetUrl = (src: string) =>
  new URL(`/${src}`, import.meta.env.VITE_API_URL).href;

type Page = (typeof categories)[number]["pages"][number];
const choices = categories.flatMap((category) =>
  category.pages.map((page, index) => ({
    page,
    label:
      category.id === "public-domain-review"
        ? `Drawing ${index + 1}`
        : page.label,
  })),
);

function PageCard({
  page,
  label,
  runtimeConfig,
  eager = false,
}: {
  page: Page;
  label: string;
  runtimeConfig?: AccountWebRuntimeConfig;
  eager?: boolean;
}) {
  return (
    <a
      className="ds-poster-card"
      href={buildNewDrawingUrl(runtimeConfig, { coloringPageId: page.id })}
      aria-label={`Color ${label}`}
      data-coloring-page={page.id}
    >
      <span className="ds-poster-card__media">
        {/* WebKit must receive loading before either source. */}
        <img
          key={page.id}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          src={assetUrl(page.previewSrc.replace(/\.png$/, "-thumb-256.webp"))}
          srcSet={`${assetUrl(page.previewSrc.replace(/\.png$/, "-thumb-256.webp"))} 1x, ${assetUrl(page.previewSrc.replace(/\.png$/, "-thumb-512.webp"))} 2x, ${assetUrl(page.previewSrc)} 3x`}
          alt=""
          width={page.size.width}
          height={page.size.height}
        />
      </span>
    </a>
  );
}

function RandomPage({
  runtimeConfig,
}: {
  runtimeConfig?: AccountWebRuntimeConfig;
}) {
  // A stable first choice keeps the build-time HTML and hydration identical.
  const [selection, setSelection] = useState({ index: 0, roll: 0 });
  const choice = choices[selection.index];
  return (
    <div className="coloringbook__random" aria-label="Pick a coloring page">
      <PageCard {...choice} runtimeConfig={runtimeConfig} eager />
      <button
        type="button"
        className="ds-button coloringbook__dice"
        aria-label="Pick a random coloring page"
        title="Pick a random coloring page"
        onClick={() =>
          setSelection((current) => ({
            index:
              (current.index +
                1 +
                Math.floor(Math.random() * (choices.length - 1))) %
              choices.length,
            roll: current.roll + 1,
          }))
        }
      >
        <span
          key={selection.roll}
          className={selection.roll ? "is-rolling" : undefined}
        >
          <Icon icon={Dice5} />
        </span>
      </button>
    </div>
  );
}

export function ColoringBookContent({
  runtimeConfig,
}: {
  runtimeConfig?: AccountWebRuntimeConfig;
}) {
  return (
    <div className="coloringbook">
      <header className="coloringbook__intro">
        <h1>Free coloring book</h1>
        <img
          className="coloringbook__preview"
          src={appPath("coloringbook-preview.webp")}
          width="2200"
          height="1520"
          fetchPriority="high"
          alt="Splatterboard’s coloring tools and palette beside a lime-green frog with a mint foot on a yellow background."
        />
      </header>
      <nav className="coloringbook__subjects" aria-label="Coloring subjects">
        {categories.map((category) => (
          <a key={category.id} href={`#${category.id}`}>
            {category.title}
          </a>
        ))}
      </nav>
      <RandomPage runtimeConfig={runtimeConfig} />
      {categories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          aria-labelledby={`${category.id}-title`}
        >
          <h2 id={`${category.id}-title`}>{category.title}</h2>
          <div className="coloringbook__pages">
            {category.pages.map((page, index) => {
              const label =
                category.id === "public-domain-review"
                  ? `Drawing ${index + 1}`
                  : page.label;
              return (
                <PageCard
                  key={page.id}
                  page={page}
                  label={label}
                  runtimeConfig={runtimeConfig}
                />
              );
            })}
          </div>
        </section>
      ))}
      <a href={assetUrl("coloring/credits/credits.txt")}>Artwork credits</a>
    </div>
  );
}

export default function ColoringBook() {
  return <ColoringBookContent />;
}
