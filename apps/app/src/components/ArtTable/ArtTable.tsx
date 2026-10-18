import { appPath } from "../../config";

export function ArtTable({ href }: { href: string }) {
  return (
    <section className="art-table" aria-labelledby="art-table-title">
      <h1 id="art-table-title">A free drawing app for kids</h1>
      <figure className="art-table__example">
        <img
          className="art-table__preview"
          src={appPath("drawing-preview.png")}
          width="2560"
          height="1600"
          alt="Splatterboard’s drawing tools around a drawing of a rainbow, a purple cat, and a yellow sun."
        />
      </figure>
      <a className="art-table__start" href={href}>
        Start drawing
      </a>
    </section>
  );
}
