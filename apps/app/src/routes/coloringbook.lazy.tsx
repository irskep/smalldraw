import { getColoringTopic } from "@smalldraw/shared";
import {
  getColoringCategories,
  publishedColoringAssetUrl,
} from "@smalldraw/splat/coloring";
import { Dice5 } from "lucide";
import { useLocation } from "preact-iso";
import { useState } from "preact/hooks";

import { Icon } from "../components/Icon";
import { appPath } from "../config";
import {
  buildNewDrawingUrl,
  type AccountWebRuntimeConfig,
} from "../utils/drawingAppLinks";

const categories = getColoringCategories();
const assetUrl = (src: string) =>
  import.meta.env.VITE_COLORING_ASSET_BASE_URL
    ? publishedColoringAssetUrl(
        src,
        import.meta.env.VITE_COLORING_ASSET_BASE_URL,
      )
    : new URL(`/${src}`, import.meta.env.VITE_API_URL).href;

type Page = (typeof categories)[number]["pages"][number];
const choices = categories.flatMap((category) =>
  category.pages.map((page, index) => ({
    page,
    categoryId: category.id,
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
          crossOrigin="anonymous"
          src={assetUrl(page.previewSrc.replace(/\.webp$/, "-thumb-256.webp"))}
          srcSet={`${assetUrl(page.previewSrc.replace(/\.webp$/, "-thumb-256.webp"))} 1x, ${assetUrl(page.previewSrc.replace(/\.webp$/, "-thumb-512.webp"))} 2x, ${assetUrl(page.previewSrc)} 3x`}
          alt={label}
          width={page.size.width}
          height={page.size.height}
        />
      </span>
    </a>
  );
}

function RandomPage({
  runtimeConfig,
  choices,
}: {
  runtimeConfig?: AccountWebRuntimeConfig;
  choices: readonly { page: Page; label: string }[];
}) {
  // A stable first choice keeps the build-time HTML and hydration identical.
  const [selection, setSelection] = useState({ index: 0, roll: 0 });
  const choice = choices[selection.index];
  return (
    <div className="coloringbook__random" aria-label="Pick a coloring page">
      <PageCard {...choice} runtimeConfig={runtimeConfig} eager />
      <button
        type="button"
        className="ds-icon-button coloringbook__dice"
        aria-label="Pick a random coloring page"
        title="Pick a random coloring page"
        disabled={choices.length < 2}
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
        <span className="ds-icon-button__content">
          <span
            key={selection.roll}
            className={`ds-icon-button__icon${selection.roll ? " is-rolling" : ""}`}
          >
            <Icon icon={Dice5} />
          </span>
        </span>
      </button>
    </div>
  );
}

export function ColoringBookContent({
  runtimeConfig,
  topic,
}: {
  runtimeConfig?: AccountWebRuntimeConfig;
  topic?: ReturnType<typeof getColoringTopic>;
}) {
  const visibleCategories = topic
    ? categories.filter((category) => category.id === topic.id)
    : categories;
  const visibleChoices = topic
    ? choices.filter((choice) => choice.categoryId === topic.id)
    : choices;
  return (
    <div className="coloringbook">
      <header
        className="coloringbook__intro"
        data-topic={topic ? "true" : undefined}
      >
        <h1>{topic?.heading ?? "Free coloring book"}</h1>
        {!topic && (
          <img
            className="coloringbook__preview"
            src={appPath("coloringbook-preview.webp")}
            width="2200"
            height="1520"
            fetchPriority="high"
            alt="Splatterboard’s coloring tools and palette beside a lime-green frog with a mint foot on a yellow background."
          />
        )}
      </header>
      <nav className="coloringbook__subjects" aria-label="Coloring subjects">
        {topic && <a href={appPath("coloringbook")}>All coloring pages</a>}
        {categories.map((category) => (
          <a
            key={category.id}
            href={
              topic ? appPath(`coloringbook/${category.id}`) : `#${category.id}`
            }
            aria-current={topic?.id === category.id ? "page" : undefined}
          >
            {category.title}
          </a>
        ))}
      </nav>
      <RandomPage
        key={topic?.id ?? "all"}
        runtimeConfig={runtimeConfig}
        choices={visibleChoices}
      />
      {visibleCategories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          aria-labelledby={topic ? undefined : `${category.id}-title`}
          aria-label={topic?.heading}
        >
          {!topic && (
            <h2 id={`${category.id}-title`}>
              <a href={appPath(`coloringbook/${category.id}`)}>
                {category.title}
              </a>
            </h2>
          )}
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
  const { path } = useLocation();
  const topic = getColoringTopic(path);
  if (path.replace(/\/$/, "") !== appPath("coloringbook") && !topic)
    return (
      <section className="portal-page">
        <h1>Page not found</h1>
        <a href={appPath("coloringbook")}>All coloring pages</a>
      </section>
    );
  return <ColoringBookContent topic={topic} />;
}
