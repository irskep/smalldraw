import { appPath } from "../../config";

export function ArtTable({ href }: { href: string }) {
  return (
    <section className="art-table" aria-labelledby="art-table-title">
      <div className="art-table__intro">
        <p className="art-table__eyebrow">A drawing app for kids & families</p>
        <h1 id="art-table-title">
          Little hands.
          <br />
          Big <span>ideas.</span>
        </h1>
        <p className="art-table__description">
          Draw, paint, and play with stamps. See what you can make.
        </p>
        <a className="art-table__start" href={href}>
          Start drawing
        </a>
        <p className="art-table__note">A free website with no ads.</p>
      </div>
      <figure className="art-table__example">
        <img
          className="art-table__preview"
          src={appPath("drawing-preview.png")}
          width="2560"
          height="1600"
          alt="Splatterboard’s drawing tools around a drawing of a rainbow, a purple cat, and a yellow sun."
        />
        <figcaption>A few colors. A little imagination.</figcaption>
      </figure>
    </section>
  );
}
