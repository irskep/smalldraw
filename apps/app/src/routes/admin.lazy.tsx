import { createLazyFileRoute } from "@tanstack/react-router";
import { KeyRound as KeyRoundIcon, Share2 as ShareIcon } from "lucide";
import { FileSearch, KeyRound, Search, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import { buildInvitationUrl } from "@/components/DocumentInvitation/buildInvitationUrl";
import {
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";
import { trpc } from "../utils/trpc";

const formatDateTime = (date: Date | string | null): string => {
  if (!date) {
    return "never";
  }
  return new Date(date).toLocaleString();
};

const Admin = () => {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [lookupUsername, setLookupUsername] = useState("");
  const [submittedUsername, setSubmittedUsername] = useState<string | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");
  const [shareLinksByDocumentId, setShareLinksByDocumentId] = useState<
    Record<string, string>
  >({});
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const meQuery = trpc.me.useQuery();
  const userQuery = trpc.adminGetUserByUsername.useQuery(
    submittedUsername ?? "",
    {
      enabled: Boolean(submittedUsername),
      retry: false,
    },
  );
  const userDocumentsQuery = trpc.adminListUserDocuments.useQuery(
    { username: submittedUsername ?? "" },
    {
      enabled: Boolean(userQuery.data),
      retry: false,
    },
  );
  const selectedDocumentDetailsQuery =
    trpc.adminGetUserDocumentDetails.useQuery(
      {
        username: userQuery.data?.username ?? "",
        documentId: selectedDocumentId ?? "",
      },
      {
        enabled: Boolean(userQuery.data?.username && selectedDocumentId),
        retry: false,
      },
    );
  const resetPasswordMutation = trpc.adminResetUserPassword.useMutation();
  const createShareLinkMutation =
    trpc.adminCreateUserDocumentShareLink.useMutation();
  const drawingRuntimeConfig = createAccountWebRuntimeConfig();

  if (meQuery.isLoading) {
    return (
      <section className="account-page account-admin" aria-label="Admin">
        <div className="account-page__header">
          <h1 className="account-title">Admin</h1>
          <p className="account-muted">Checking access…</p>
        </div>
      </section>
    );
  }

  if (!meQuery.data?.isServerAdmin) {
    return (
      <section className="account-page account-admin" aria-label="Admin">
        <div className="account-page__header">
          <h1 className="account-title">Admin access required</h1>
          <p className="account-muted">
            Log in with a server admin account to use these tools.
          </p>
        </div>
      </section>
    );
  }

  const foundUser = userQuery.data;

  const resetPassword = async () => {
    if (!foundUser || !newPassword.trim()) {
      return;
    }
    const confirmed =
      (await confirmDialogRef.current?.confirm({
        title: "Reset password?",
        message: `This changes the password for ${foundUser.username} and revokes existing sessions.`,
        confirmLabel: "Reset password",
        cancelLabel: "Cancel",
        tone: "danger",
        icon: KeyRoundIcon,
      })) ?? false;
    if (!confirmed) {
      return;
    }

    setResetMessage(null);
    setResetError(null);
    try {
      await resetPasswordMutation.mutateAsync({
        username: foundUser.username,
        newPassword,
      });
      setNewPassword("");
      setResetMessage(`Password reset for ${foundUser.username}.`);
    } catch (error) {
      setResetError(
        error instanceof Error
          ? error.message
          : "Password reset failed. Please try again.",
      );
    }
  };

  return (
    <section className="account-page account-admin" aria-label="Admin">
      <div className="account-page__header">
        <h1 className="account-title">Admin</h1>
        <p className="account-subtitle">User support tools.</p>
      </div>

      <section className="account-card account-card--padded">
        <h2 className="account-title">Find user</h2>
        <form
          className="account-form account-form--inline"
          onSubmit={(event) => {
            event.preventDefault();
            const username = lookupUsername.trim();
            if (!username) {
              return;
            }
            setResetMessage(null);
            setResetError(null);
            setShareLinkError(null);
            setShareLinksByDocumentId({});
            setSelectedDocumentId(null);
            setSubmittedUsername(username);
          }}
        >
          <input
            className="account-input account-input--short"
            value={lookupUsername}
            onChange={(event) => setLookupUsername(event.target.value)}
            placeholder="Search account"
            aria-label="User lookup"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            inputMode="search"
            name="admin-user-lookup"
            spellCheck={false}
            type="search"
          />
          <button type="submit" className="ds-button">
            <Search className="account-action-icon" />
            Search
          </button>
        </form>

        {userQuery.isFetching ? (
          <p className="account-muted">Searching…</p>
        ) : null}
        {submittedUsername && userQuery.data === null ? (
          <div className="account-alert" data-tone="danger" role="alert">
            <div className="account-alert__body">
              <div className="account-alert__title">User not found</div>
              <div>No account exists for {submittedUsername}.</div>
            </div>
          </div>
        ) : null}
      </section>

      {foundUser ? (
        <section className="account-card account-card--padded">
          <h2 className="account-title">{foundUser.username}</h2>
          <dl className="account-details">
            <div>
              <dt>User ID</dt>
              <dd className="account-code">{foundUser.id}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{foundUser.isServerAdmin ? "Server admin" : "User"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(foundUser.createdAt).toLocaleString()}</dd>
            </div>
          </dl>

          <form
            className="account-form account-form--inline"
            onSubmit={(event) => {
              event.preventDefault();
              void resetPassword();
            }}
          >
            <input
              className="account-input account-input--short"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              aria-label="New password"
            />
            <button
              type="submit"
              className="ds-button"
              data-tone="danger"
              disabled={
                !newPassword.trim() || resetPasswordMutation.isPending
              }
            >
              <KeyRound className="account-action-icon" />
              Reset password
            </button>
          </form>

          {resetMessage ? (
            <div className="account-alert" role="status">
              <div className="account-alert__body">
                <div className="account-alert__title">Password reset</div>
                <div>{resetMessage}</div>
              </div>
            </div>
          ) : null}
          {resetError ? (
            <div className="account-alert" data-tone="danger" role="alert">
              <div className="account-alert__body">
                <div className="account-alert__title">Reset failed</div>
                <div>{resetError}</div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {foundUser ? (
        <section className="account-card account-card--padded">
          <h2 className="account-title">Drawings</h2>
          {userDocumentsQuery.isLoading ? (
            <p className="account-muted">Loading drawings…</p>
          ) : null}
          {userDocumentsQuery.data?.length === 0 ? (
            <p className="account-muted">This user has no shared drawings.</p>
          ) : null}
          {userDocumentsQuery.data?.map((document) => {
            const shareLink = shareLinksByDocumentId[document.id];
            return (
              <div key={document.id} className="account-list-item">
                <div className="account-list-item__main">
                  <div>{document.name}</div>
                  <div className="account-muted account-muted--small account-code">
                    {document.id}
                  </div>
                  {shareLink ? (
                    <input
                      className="account-input account-input--share"
                      readOnly
                      value={shareLink}
                      onFocus={(event) => event.currentTarget.select()}
                      aria-label={`Share link for ${document.name}`}
                    />
                  ) : null}
                </div>
                <div className="account-form-row">
                  <button
                    type="button"
                    className="ds-button"
                    data-selected={selectedDocumentId === document.id}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <FileSearch className="account-action-icon" />
                    Inspect
                  </button>
                  {document.currentAdminHasAccess ? (
                    <a
                      className="ds-button"
                      href={buildDrawingDocumentUrl(
                        document.id,
                        drawingRuntimeConfig,
                      )}
                    >
                      Open drawing
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="ds-button"
                      disabled={createShareLinkMutation.isPending}
                      onClick={async () => {
                        const confirmed =
                          (await confirmDialogRef.current?.confirm({
                            title: "Create share link?",
                            message: `This creates a link that can open ${document.name}. Anyone with the link can join the drawing.`,
                            confirmLabel: "Create link",
                            cancelLabel: "Cancel",
                            tone: "danger",
                            icon: ShareIcon,
                          })) ?? false;
                        if (!confirmed) {
                          return;
                        }

                        setShareLinkError(null);
                        try {
                          const result =
                            await createShareLinkMutation.mutateAsync({
                              username: foundUser.username,
                              documentId: document.id,
                            });
                          setShareLinksByDocumentId((current) => ({
                            ...current,
                            [document.id]: buildInvitationUrl(result.token),
                          }));
                        } catch (error) {
                          setShareLinkError(
                            error instanceof Error
                              ? error.message
                              : "Share link could not be created.",
                          );
                        }
                      }}
                    >
                      <Share2 className="account-action-icon" />
                      Create share link
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {shareLinkError ? (
            <div className="account-alert" data-tone="danger" role="alert">
              <div className="account-alert__body">
                <div className="account-alert__title">Share link failed</div>
                <div>{shareLinkError}</div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {foundUser && selectedDocumentId ? (
        <section className="account-card account-card--padded">
          <h2 className="account-title">Document inspection</h2>
          {selectedDocumentDetailsQuery.isLoading ? (
            <p className="account-muted">Loading document details…</p>
          ) : null}
          {selectedDocumentDetailsQuery.error ? (
            <div className="account-alert" data-tone="danger" role="alert">
              <div className="account-alert__body">
                <div className="account-alert__title">
                  Document details could not be loaded
                </div>
                <div>{selectedDocumentDetailsQuery.error.message}</div>
              </div>
            </div>
          ) : null}
          {selectedDocumentDetailsQuery.data ? (
            <div className="account-two-column">
              <section className="account-card account-card--padded">
                <h3 className="account-label">
                  {selectedDocumentDetailsQuery.data.document.name}
                </h3>
                <dl className="account-details">
                  <div>
                    <dt>Document ID</dt>
                    <dd className="account-code">
                      {selectedDocumentDetailsQuery.data.document.id}
                    </dd>
                  </div>
                  <div>
                    <dt>Target user role</dt>
                    <dd>
                      {selectedDocumentDetailsQuery.data.document.isAdmin
                        ? "Document admin"
                        : "Member"}
                    </dd>
                  </div>
                  <div>
                    <dt>Viewing admin access</dt>
                    <dd>
                      {selectedDocumentDetailsQuery.data.document
                        .currentAdminHasAccess
                        ? "Already has access"
                        : "No membership"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="account-card account-card--padded">
                <h3 className="account-label">Members</h3>
                <div className="account-list">
                  {selectedDocumentDetailsQuery.data.members.length === 0 ? (
                    <p className="account-muted">No members found.</p>
                  ) : null}
                  {selectedDocumentDetailsQuery.data.members.map((member) => (
                    <div key={member.id} className="account-list-item">
                      <div className="account-list-item__main">
                        <div>{member.username}</div>
                        <div className="account-muted account-muted--small account-code">
                          {member.id}
                        </div>
                      </div>
                      <div className="account-muted account-muted--small">
                        {member.isAdmin ? "document admin" : "member"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="account-card account-card--padded">
                <h3 className="account-label">Access tokens</h3>
                <div className="account-list">
                  {selectedDocumentDetailsQuery.data.accessTokens.length ===
                  0 ? (
                    <p className="account-muted">
                      No owner or device tokens recorded.
                    </p>
                  ) : null}
                  {selectedDocumentDetailsQuery.data.accessTokens.map(
                    (token) => (
                      <div
                        key={token.id}
                        className="account-list-item account-list-item--stacked"
                      >
                        <div className="account-list-item">
                          <div>
                            {token.scope}
                            {token.tag ? `:${token.tag}` : ""}
                          </div>
                          <div className="account-muted account-muted--small">
                            {token.revokedAt ? "revoked" : "active"}
                          </div>
                        </div>
                        <div className="account-muted account-muted--small">
                          Created: {formatDateTime(token.createdAt)}
                        </div>
                        <div className="account-muted account-muted--small">
                          Last used: {formatDateTime(token.lastUsedAt)}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : null}

      <DsConfirmDialog ref={confirmDialogRef} />
    </section>
  );
};

export const Route = createLazyFileRoute("/admin")({
  component: Admin,
});
