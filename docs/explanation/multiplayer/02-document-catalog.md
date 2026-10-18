# Document catalog and workspaces

The browser needs list metadata before it opens every drawing. `KidsDocumentSummary` and `KidsDocumentBackend` in `packages/splat/src/documents/types.ts` describe that catalog interface; `localDocumentBackend.ts` persists local entries and thumbnails.

## Identity boundaries

A catalog entry's `docUrl` is the key used by the document browser. `collabDocUrl`, when present, identifies the Automerge content used for collaboration. `resolveDocumentOpenUrl` in `documents/collaboration.ts` chooses the content URL. Joined documents can use a catalog key derived from the collaborative identity; do not pass arbitrary catalog keys directly to repo APIs.

Title, thumbnail, timestamps, collaboration metadata, account attachment, join secret and access token belong to the catalog/access layer. They are not a replacement for drawing content. Metadata can exist while binary content is unavailable; opening should surface that failure rather than silently substitute a blank drawing.

## Workspaces

The current workspace implementation separates guest/account catalog names, repo storage, selected-document keys and broadcast channels. `workspace.ts` owns namespace construction. `accountWorkspace.ts` coordinates identity resolution, guest import, synchronization and logout cleanup; `runtimeAssembly.ts` integrates the result with app startup.

That account workflow is changing concurrently with this documentation pass. Review its implementation and account-workspace tests for exact migration/retry behavior. The durable boundary is that data and cross-tab channels must belong to the intended identity; a temporary network error must not be interpreted as proof of logout.

## Browser presentation

“On this device,” account saving, and sharing describe different states. The account session determines sign-in/out controls; document access metadata determines which document operations are available. A shared drawing is not proof that its creator has an account, and an account-saved drawing need not be publicly joinable.

Thumbnail aspect ratio is presentation: the browser contains the original image within its card instead of stretching it to the card's proportions. Thumbnail generation must retain the same layer-isolation semantics as export.
