# Coloring asset hosting

Public artwork lives in the `splatterboard-assets` R2 Standard bucket, connected
to `https://assets.splatterboard.app` (minimum TLS 1.2). User drawing thumbnails
remain in the separate `splatterboard-thumbnails` bucket.

`mise run deploy` runs these steps in order:

1. Build: prepare the asset manifest and frontend bundles. SVG objects are
   gzip-compressed without rasterization; WebP bytes remain unchanged.
2. Publish: check every object's size and MD5 via the R2 inventory, upload missing
   objects, and fully verify new or restored collections. Unchanged collections
   reuse verification receipts, with live CDN probes for each MIME/encoding pair.
3. Deploy the Fly image, which contains no coloring artwork.

Publishing uses `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`
from the untracked `.env.prod`. The key needs Object Read & Write access to
`splatterboard-assets`. These credentials are never embedded in the frontend.

Asset URLs include a hash of their collection's filenames and encoded contents.
The generated `packages/splat/src/coloring/assetVersions.json` is committed; it is
only 3.8 KB rather than a browser-side table of thousands of individual files.
Unchanged collections are reused across releases. Editing a collection creates
a new version of that collection, not a new copy of the entire catalog. An
unchanged deployment uploads zero objects. Publication refuses to overwrite a
mismatching immutable key. No automatic deletion occurs during deployment.

Keep old versions while drawings or older app clients reference them. If storage
usage grows materially, review unused collection versions before removing them;
do not apply a blanket age-based lifecycle to all published objects. The initial
catalog occupies about 260 MB of R2's 10 GB-month Standard free allowance, which
is shared with the account's other buckets.

Image extensions use Cloudflare's default CDN caching with one-year immutable
Cache-Control headers. SVG objects have `Content-Type: image/svg+xml` and
`Content-Encoding: gzip`. Test CDN caching with GET requests, not HEAD alone.
`coloring-assets-cors.json` contains the explicit production and development/test
origins allowed to read images into a canvas. Apply changes with:

```sh
bun $(which wrangler) r2 bucket cors set splatterboard-assets --file infra/coloring-assets-cors.json
```

Local development and ordinary tests serve local source artwork. The dedicated
`mise run test:browser:assets` builds production bundles against an isolated
second-origin asset server and tests the gallery, fills, persistence, and stamps
in Chromium and WebKit without Cloudflare credentials.

To regenerate asset metadata without a full build, use `mise run assets:prepare`.
The ignored `.coloring-assets/` directory contains upload metadata and compressed
SVGs, outside the Docker context. Run `mise run assets:publish` only after building
or preparing. Never deploy a build whose asset publication failed.

Receipts live under `asset-verification/v1/` in the same bucket, outside the
artwork inventory. Their keys fingerprint the full collection manifest (including
response metadata), public hostname, and CORS origin. They are written only after
all uploads and public checks succeed. Changing the verification contract requires
bumping the receipt version. Missing objects always force a collection recheck;
checksum or size mismatches still fail deployment even when a receipt exists.

Run `mise run assets:audit` after preparing/building for a read-only full audit.
It ignores receipts, verifies every public URL, and fails on missing objects
instead of uploading them. Normal deploys do not detect isolated header drift on
unprobed existing objects; use the audit after manual bucket/CDN policy changes.

Rollback: deploy the previous application image. Retaining immutable assets
keeps previous CDN-based application releases working. The pre-migration Fly
image includes its own artwork and can also be redeployed.
