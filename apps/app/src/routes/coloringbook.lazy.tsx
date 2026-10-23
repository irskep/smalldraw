import { getColoringCategories } from "@smalldraw/splat/coloring";

import { appPath } from "../config";
import { buildNewDrawingUrl } from "../utils/drawingAppLinks";

import "./coloringbook.css";

const categories = getColoringCategories();
const assetUrl = (src: string) =>
  new URL(`/${src}`, import.meta.env.VITE_API_URL).href;

export default function ColoringBook() {
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
                <a
                  className="ds-poster-card"
                  key={page.id}
                  href={buildNewDrawingUrl(undefined, {
                    coloringPageId: page.id,
                  })}
                  aria-label={`Color ${label}`}
                  data-coloring-page={page.id}
                >
                  <span className="ds-poster-card__media">
                    {/* WebKit must receive loading="lazy" before either source. */}
                    <img
                      loading="lazy"
                      decoding="async"
                      src={assetUrl(
                        page.previewSrc.replace(/\.png$/, "-thumb-256.webp"),
                      )}
                      srcSet={`${assetUrl(page.previewSrc.replace(/\.png$/, "-thumb-256.webp"))} 1x, ${assetUrl(page.previewSrc.replace(/\.png$/, "-thumb-512.webp"))} 2x, ${assetUrl(page.previewSrc)} 3x`}
                      alt=""
                      width={page.size.width}
                      height={page.size.height}
                    />
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
      <a href={assetUrl("coloring/credits/credits.txt")}>Artwork credits</a>
    </div>
  );
}
