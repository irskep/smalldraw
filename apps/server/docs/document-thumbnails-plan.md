# Document Thumbnails Plan

## Goal

Render drawing thumbnails in the account management app using server-managed metadata and R2 object storage.

## Design

- The drawing app remains responsible for generating thumbnail image blobs.
- The server owns durable thumbnail storage and metadata.
- SQLite stores metadata only, not image blobs.
- R2 stores the actual image bytes.
- Reads use `R2_PUBLIC_BASE_URL` directly; no proxy route is needed for basic rendering.

## Storage model

Add a `document_thumbnails` table with:

- `document_id` primary key, fk to `documents.id`
- `storage_key` unique text
- `content_type` text
- `updated_at` timestamp

Deterministic storage key:

- `documents/<documentId>/thumbnail.png`

Overwrite-in-place on upload.

## Auth model

- Only authenticated document admins can upload/update a thumbnail.
- Portal reads thumbnail URL from document list/get APIs.
- Anonymous/token auth is not sufficient for this server-managed thumbnail path.

## API shape

- `uploadDocumentThumbnail({ documentId, contentType, contentBase64 })`
- `documents` returns `thumbnailUrl`
- `getDocument(documentId)` returns `thumbnailUrl`

## Runtime behavior

- In `splat-web`, after a local thumbnail save, if the drawing is collaborative and account-attached, upload the same blob to the server.
- Upload should be best-effort and non-blocking relative to local thumbnail persistence.
- Management app list renders `thumbnailUrl` when present.

## TDD sequence

1. Red: DB tests for create/update/list thumbnail metadata
2. Green: DB helper + migration
3. Red: server route tests for admin/member upload auth and list/get projection
4. Green: Bun.S3Client-backed storage adapter + route wiring
5. Red: portal component test for document list thumbnail rendering
6. Green: portal list UI update
7. Red: drawing app test proving account-attached docs attempt thumbnail upload
8. Green: drawing app upload hook

## Notes

- Use Bun's native `S3Client`, not AWS SDK.
- Required env:
  - `R2_ACCOUNT_ID`
  - `R2_BUCKET`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_PUBLIC_BASE_URL`
- Region should be `auto`.
