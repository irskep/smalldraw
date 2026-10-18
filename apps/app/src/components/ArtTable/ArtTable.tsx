import { appPath } from "../../config";

export function ArtTable({ href }: { href: string }) {
  return (
    <section className="art-table" aria-labelledby="art-table-title">
      <h1 id="art-table-title">A free drawing app for kids</h1>
      <a className="art-table__start" href={href}>
        <span aria-hidden="true">+</span> Start drawing
      </a>
      <figure className="art-table__example">
        <img
          className="art-table__preview"
          src={appPath("drawing-preview.png")}
          width="1280"
          height="800"
          alt="Splatterboard’s drawing tools around a drawing of a rainbow, a purple cat, and a yellow sun."
        />
      </figure>
    </section>
  );
}
