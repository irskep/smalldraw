import { useLocation, useRoute } from "preact-iso";
import { useEffect, useRef, useState } from "react";

import { appPath } from "../config";
import { useResource } from "../hooks/useResource";
import { api } from "../utils/api";
import { AdminAccessGate } from "./AdminAccessGate";

import "./moderation.css";

type Drawing = Awaited<ReturnType<typeof api.adminDrawingDetails.query>>;
type Feed = Awaited<ReturnType<typeof api.adminDrawingFeed.query>>;
type Filter = "all" | "shared" | "taken-down";
const date = (value: number | null) =>
  value === null ? "Unknown" : new Date(value).toLocaleString();
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Try again.";
const drawingPath = (id: string) =>
  appPath(`admin/drawings/${encodeURIComponent(id)}`);

function Thumbnail({
  drawing,
  className = "",
}: {
  drawing: Pick<Drawing, "id" | "hasThumbnail" | "moderation">;
  className?: string;
}) {
  const image = useResource(
    (signal) =>
      api.adminDrawingThumbnail.query({ documentId: drawing.id }, { signal }),
    [drawing.id, drawing.hasThumbnail, Boolean(drawing.moderation)],
    { enabled: drawing.hasThumbnail && !drawing.moderation },
  );
  return (
    <div className={`moderation-image ${className}`}>
      {!drawing.moderation && image.data ? (
        <img
          src={`data:${image.data.contentType};base64,${image.data.data}`}
          alt="Drawing preview"
        />
      ) : (
        <span>
          {drawing.moderation
            ? "Taken down"
            : image.loading
              ? "Loading preview…"
              : "No preview"}
        </span>
      )}
    </div>
  );
}

export function AdminModerationFeed() {
  const { route } = useLocation();
  const [lookup, setLookup] = useState("");
  const [username, setUsername] = useState("");
  const [finding, setFinding] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [feed, setFeed] = useState<Feed>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const lookupRequest = useRef<AbortController | null>(null);

  async function load(nextFilter: Filter, more = false) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    if (!more) setFeed({ items: [], nextCursor: null });
    try {
      const page = await api.adminDrawingFeed.query(
        {
          filter: nextFilter,
          limit: 24,
          cursor: more ? (feed.nextCursor ?? undefined) : undefined,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setFeed((previous) => ({
        items: more
          ? [
              ...new Map(
                [...previous.items, ...page.items].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ]
          : page.items,
        nextCursor: page.nextCursor,
      }));
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorText(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    void load(filter);
    return () => request.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Filter changes start a fresh traversal, never an automatic refresh.
  }, [filter]);
  useEffect(() => () => lookupRequest.current?.abort(), []);

  return (
    <section
      className="admin-page moderation-page"
      aria-label="Drawing moderation"
    >
      <header className="moderation-heading">
        <h1 className="portal-title">Drawing moderation</h1>
        <span className="portal-muted">Server-stored drawings</span>
      </header>
      <form
        className="moderation-lookup"
        onSubmit={(event) => {
          event.preventDefault();
          if (!lookup.trim() || finding) return;
          setFinding(true);
          setLookupError(null);
          const controller = new AbortController();
          lookupRequest.current = controller;
          void api.adminFindDrawing
            .query({ lookup: lookup.trim() }, { signal: controller.signal })
            .then((drawing) => {
              if (!controller.signal.aborted) {
                if (drawing) route(drawingPath(drawing.id));
                else setLookupError("Drawing not found.");
              }
            })
            .catch((cause) => {
              if (!controller.signal.aborted) setLookupError(errorText(cause));
            })
            .finally(() => {
              if (!controller.signal.aborted) setFinding(false);
            });
        }}
      >
        <label className="moderation-field">
          Find drawing
          <input
            className="portal-input"
            value={lookup}
            onChange={(event) => setLookup(event.currentTarget.value)}
            placeholder="Drawing URL, share URL, or document ID"
            autoCapitalize="none"
            autoCorrect="off"
            spellcheck={false}
            required
            maxLength={2048}
          />
        </label>
        <button className="ds-button" disabled={finding}>
          {finding ? "Finding…" : "Find"}
        </button>
      </form>
      {lookupError && (
        <p role="alert" className="portal-error">
          {lookupError}
        </p>
      )}
      <div className="moderation-heading">
        <h2>
          {filter === "taken-down"
            ? "Taken-down drawings"
            : "Recently updated drawings"}
        </h2>
        <button
          className="ds-button"
          disabled={loading}
          onClick={() => void load(filter)}
        >
          Refresh
        </button>
      </div>
      <div
        className="moderation-filters"
        role="group"
        aria-label="Filter drawings"
      >
        {(
          [
            ["all", "All"],
            ["shared", "Shared"],
            ["taken-down", "Taken down"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className="ds-button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="portal-error">
          {error}{" "}
          <button
            className="ds-button"
            onClick={() => void load(filter, feed.items.length > 0)}
          >
            Try again
          </button>
        </p>
      )}
      <div className="moderation-grid" aria-busy={loading}>
        {feed.items.map((drawing) => (
          <a
            key={drawing.id}
            className="moderation-card"
            href={drawingPath(drawing.id)}
          >
            <Thumbnail drawing={drawing} />
            <div className="moderation-card__caption">
              <strong>
                {drawing.owners.length
                  ? drawing.owners.map((owner) => owner.username).join(", ")
                  : "Guest"}
              </strong>
              <span>
                {drawing.moderation
                  ? "Taken down"
                  : drawing.deletedAt
                    ? "In user trash"
                    : drawing.shared
                      ? "Shared"
                      : "Account drawing"}
              </span>
              <time
                dateTime={new Date(
                  drawing.moderation?.takenDownAt ?? drawing.contentUpdatedAt,
                ).toISOString()}
              >
                {date(
                  drawing.moderation?.takenDownAt ?? drawing.contentUpdatedAt,
                )}
              </time>
              <span className="moderation-id">{drawing.id}</span>
            </div>
          </a>
        ))}
      </div>
      {loading && <p role="status">Loading drawings…</p>}
      {!loading && !error && feed.items.length === 0 && (
        <p>No drawings found.</p>
      )}
      {feed.nextCursor && (
        <button
          className="ds-button moderation-more"
          disabled={loading}
          onClick={() => void load(filter, true)}
        >
          Load more
        </button>
      )}
      <details className="admin-panel moderation-support">
        <summary>Account support</summary>
        <form
          className="moderation-lookup"
          onSubmit={(event) => {
            event.preventDefault();
            if (username.trim())
              route(
                appPath(`admin/users/${encodeURIComponent(username.trim())}`),
              );
          }}
        >
          <label className="moderation-field">
            Username
            <input
              className="portal-input"
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellcheck={false}
              required
            />
          </label>
          <button className="ds-button">Find account</button>
        </form>
      </details>
    </section>
  );
}

export function AdminDrawingInspection({ documentId }: { documentId: string }) {
  const details = useResource(
    (signal) => api.adminDrawingDetails.query({ documentId }, { signal }),
    [documentId],
  );
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [takenDown, setTakenDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewRequest = useRef<AbortController | null>(null);
  useEffect(() => () => previewRequest.current?.abort(), []);
  const drawing = details.data;
  const blocked = takenDown || Boolean(drawing?.moderation);
  useEffect(() => {
    if (drawing?.moderation) {
      previewRequest.current?.abort();
      setPreview(null);
      setLoadingPreview(false);
    }
  }, [drawing?.moderation]);
  async function loadPreview() {
    const controller = new AbortController();
    previewRequest.current?.abort();
    previewRequest.current = controller;
    setLoadingPreview(true);
    setError(null);
    try {
      const [encoded, { renderDrawingPreview }] = await Promise.all([
        api.adminDrawingSnapshot.query(
          { documentId },
          { signal: controller.signal },
        ),
        import("@smalldraw/splat/preview"),
      ]);
      if (controller.signal.aborted) return;
      const image = await renderDrawingPreview(
        Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
        controller.signal,
      );
      if (!controller.signal.aborted) setPreview(image);
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorText(cause));
    } finally {
      if (!controller.signal.aborted) setLoadingPreview(false);
    }
  }
  async function moderate(retry: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (retry) await api.adminRetryDrawingCleanup.mutate({ documentId });
      else
        await api.adminTakeDownDrawing.mutate({
          documentId,
          reason: reason.trim(),
        });
      setTakenDown(true);
      previewRequest.current?.abort();
      setPreview(null);
      setLoadingPreview(false);
      setConfirming(false);
      await details.reload();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="admin-page moderation-page"
      aria-label="Inspect drawing"
    >
      <a href={appPath("admin")}>← Drawings</a>
      <header>
        <h1 className="portal-title">Inspect drawing</h1>
        <p className="moderation-id">{documentId}</p>
      </header>
      {details.loading && <p role="status">Loading drawing details…</p>}
      {details.error && (
        <p role="alert">
          {errorText(details.error)}{" "}
          <button className="ds-button" onClick={() => void details.reload()}>
            Try again
          </button>
        </p>
      )}
      {drawing && (
        <>
          <div className="moderation-detail">
            <section className="admin-section" aria-label="Drawing preview">
              {blocked ? (
                <div className="moderation-image moderation-image--detail">
                  Taken down
                </div>
              ) : preview ? (
                <div className="moderation-image moderation-image--detail">
                  <img src={preview} alt="Full drawing" />
                </div>
              ) : (
                <Thumbnail
                  drawing={drawing}
                  className="moderation-image--detail"
                />
              )}
              {!blocked && (
                <button
                  className="ds-button"
                  disabled={loadingPreview || busy}
                  onClick={() => void loadPreview()}
                >
                  {loadingPreview ? "Loading drawing…" : "Load drawing"}
                </button>
              )}
            </section>
            <section className="admin-panel">
              <dl className="moderation-facts">
                <dt>Owner</dt>
                <dd>
                  {drawing.owners.length
                    ? drawing.owners.map((owner) => (
                        <a
                          key={owner.id}
                          href={appPath(
                            `admin/users/${encodeURIComponent(owner.username)}`,
                          )}
                        >
                          {owner.username}
                        </a>
                      ))
                    : "Guest"}
                </dd>
                <dt>Created</dt>
                <dd>{date(drawing.createdAt)}</dd>
                <dt>Drawing updated</dt>
                <dd>{date(drawing.contentUpdatedAt)}</dd>
                <dt>Status</dt>
                <dd>
                  {blocked
                    ? "Taken down"
                    : drawing.deletedAt
                      ? "In user trash"
                      : drawing.shared
                        ? "Shared"
                        : "Not shared"}
                </dd>
              </dl>
              {!blocked && drawing.shareTokens.length > 0 && (
                <section>
                  <h2>Share links</h2>
                  <ul className="moderation-links">
                    {drawing.shareTokens.map((token) => (
                      <li key={token}>
                        <a
                          href={`/draw/shared/${encodeURIComponent(token)}`}
                          target="_blank"
                          rel="noreferrer"
                        >{`${window.location.origin}/draw/shared/${token}`}</a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!blocked && !confirming && (
                <button
                  className="ds-button"
                  data-tone="danger"
                  onClick={() => setConfirming(true)}
                >
                  Take down drawing
                </button>
              )}
              {blocked && !drawing.moderation && (
                <section className="moderation-takedown">
                  <p role="status">
                    The drawing is taken down. Access is blocked.
                  </p>
                  <button
                    className="ds-button"
                    disabled={busy || details.fetching}
                    onClick={() => void details.reload()}
                  >
                    Refresh cleanup status
                  </button>
                </section>
              )}
              {drawing.moderation && (
                <section className="moderation-takedown">
                  <h2>Taken down</h2>
                  <dl className="moderation-facts">
                    <dt>When</dt>
                    <dd>{date(drawing.moderation.takenDownAt)}</dd>
                    <dt>Administrator</dt>
                    <dd className="moderation-id">
                      {drawing.moderation.administratorId}
                    </dd>
                    <dt>Reason</dt>
                    <dd>{drawing.moderation.reason}</dd>
                    <dt>Cleanup</dt>
                    <dd>
                      {drawing.moderation.cleanupState === "complete"
                        ? "Complete"
                        : "Pending — access is blocked"}
                    </dd>
                  </dl>
                  {drawing.moderation.lastError && (
                    <p>{drawing.moderation.lastError}</p>
                  )}
                  {drawing.moderation.cleanupState !== "complete" && (
                    <button
                      className="ds-button"
                      disabled={busy}
                      onClick={() => void moderate(true)}
                    >
                      {busy ? "Retrying…" : "Retry cleanup"}
                    </button>
                  )}
                  <button
                    className="ds-button"
                    disabled={busy || details.fetching}
                    onClick={() => void details.reload()}
                  >
                    Refresh status
                  </button>
                </section>
              )}
            </section>
          </div>
          {confirming && !blocked && (
            <form
              className="admin-panel moderation-confirm"
              aria-label="Confirm takedown"
              onSubmit={(event) => {
                event.preventDefault();
                if (reason.trim()) void moderate(false);
              }}
            >
              <h2>Take down this drawing?</h2>
              <Thumbnail
                drawing={drawing}
                className="moderation-image--confirmation"
              />
              <p>
                This blocks access immediately and removes the server’s copy. It
                cannot be restored from user trash.
              </p>
              <label className="moderation-field">
                Reason
                <textarea
                  className="portal-input"
                  value={reason}
                  onChange={(event) => setReason(event.currentTarget.value)}
                  maxLength={1000}
                  required
                  rows={3}
                  autoFocus
                />
              </label>
              <div className="moderation-heading">
                <button
                  type="button"
                  className="ds-button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
                <button
                  className="ds-button"
                  data-tone="danger"
                  disabled={busy || !reason.trim()}
                >
                  {busy ? "Taking down…" : "Confirm takedown"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="portal-error">
          {error}
        </p>
      )}
    </section>
  );
}

export function AdminDrawingRoute() {
  const { documentId } = useRoute().params;
  return (
    <AdminAccessGate>
      <AdminDrawingInspection key={documentId} documentId={documentId} />
    </AdminAccessGate>
  );
}
