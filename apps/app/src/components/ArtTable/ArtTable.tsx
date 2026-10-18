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
          A space to doodle, paint, and see what happens. Pick a color, try a
          stamp, make something wonderfully you.
        </p>
        <a className="art-table__start" href={href}>
          Start drawing <span aria-hidden="true">↗</span>
        </a>
        <p className="art-table__note">
          Right in your browser. No account needed.
        </p>
      </div>
      <figure className="art-table__example">
        <div className="art-table__paper">
          <svg
            viewBox="0 0 600 440"
            role="img"
            aria-labelledby="art-table-art-title"
          >
            <title id="art-table-art-title">
              A playful drawing of a purple creature with a yellow crown,
              surrounded by flowers and colorful scribbles
            </title>
            <g strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M64 102 Q83 43 111 89 T162 69"
                fill="none"
                stroke="#f6bb41"
                strokeWidth="13"
              />
              <path
                d="M460 64 l10 -18 m12 29 24 -7 m-22 25 16 13"
                stroke="#e96b4b"
                strokeWidth="6"
              />
              <path
                d="M192 315 C162 269 184 205 197 176 C207 143 244 134 272 149 C300 112 351 131 370 162 C416 184 421 252 399 305 C378 355 229 363 192 315Z"
                fill="#a996d9"
                stroke="#433252"
                strokeWidth="5"
              />
              <path
                d="M235 142 l-15 -56 40 24 26 -48 24 45 44 -26 -10 55"
                fill="#f6c644"
                stroke="#433252"
                strokeWidth="5"
              />
              <ellipse
                cx="257"
                cy="214"
                rx="24"
                ry="31"
                fill="#fffdf7"
                transform="rotate(-8 257 214)"
              />
              <ellipse
                cx="328"
                cy="209"
                rx="25"
                ry="32"
                fill="#fffdf7"
                transform="rotate(10 328 209)"
              />
              <path
                d="M263 214 l0 8 m58 -11 0 8"
                stroke="#433252"
                strokeWidth="12"
              />
              <path
                d="M260 269 Q291 303 333 264"
                fill="none"
                stroke="#433252"
                strokeWidth="6"
              />
              <path
                d="M221 250 l12 3 m123 -8 12 -3"
                stroke="#e97182"
                strokeWidth="12"
              />
              <path
                d="M191 247 Q144 232 137 202 m265 41 q47 -3 51 -45 M236 343 l-8 36 -28 2 m150 -39 13 36 28 -5"
                fill="none"
                stroke="#433252"
                strokeWidth="6"
              />
              <path
                d="M92 356 q15 -37 7 -77 m-1 49 -24 -14 m28 -6 22 -13"
                fill="none"
                stroke="#639078"
                strokeWidth="5"
              />
              <path
                d="M98 276 C58 293 58 253 82 252 C62 221 104 211 110 243 C141 222 158 259 124 269 C145 298 105 311 98 276"
                fill="#ed836c"
              />
              <circle cx="104" cy="262" r="12" fill="#f6c644" />
              <path
                d="M458 347 q12 -36 25 -59 m-15 36 28 -6"
                fill="none"
                stroke="#639078"
                strokeWidth="5"
              />
              <path
                d="M481 288 C448 294 445 267 469 264 C457 235 490 231 495 258 C521 242 538 271 511 280 C526 304 491 315 481 288"
                fill="#f6c644"
              />
              <circle cx="489" cy="275" r="10" fill="#e96b4b" />
              <path
                d="M451 146 q24 -35 37 -5 t35 -10 M42 381 q19 -11 35 -1 t33 -1"
                fill="none"
                stroke="#6d9fb8"
                strokeWidth="7"
              />
              <path
                d="M155 133 l3 1 m282 249 3 -1 M533 207 l1 2"
                stroke="#ed836c"
                strokeWidth="10"
              />
            </g>
          </svg>
        </div>
        <figcaption>A very important royal monster.</figcaption>
        <div className="art-table__colors" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </figure>
    </section>
  );
}
