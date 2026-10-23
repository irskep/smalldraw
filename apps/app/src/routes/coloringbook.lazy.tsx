import { getColoringCategories } from "@smalldraw/splat/coloring";

import { buildNewDrawingUrl } from "../utils/drawingAppLinks";

import "./coloringbook.css";

const categories = getColoringCategories();
const assetUrl = (src: string) =>
  new URL(`/${src}`, import.meta.env.VITE_API_URL).href;

export default function ColoringBook() {
  return (
    <div className="coloringbook">
      <header className="coloringbook__intro">
        <h1>A free coloring book app</h1>
        <p>
          Color with a tap, paint with a brush, or add a few stamps. No ads or
          signup required.
        </p>
      </header>
      <nav className="coloringbook__subjects" aria-label="Coloring subjects">
        {categories.map((category) => (
          <a className="ds-button" key={category.id} href={`#${category.id}`}>
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
                    <img
                      src={assetUrl(page.src)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={page.size.width}
                      height={page.size.height}
                    />
                  </span>
                  <span className="ds-poster-card__label">{label}</span>
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
