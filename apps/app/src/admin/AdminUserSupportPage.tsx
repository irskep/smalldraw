import { Link } from "@tanstack/react-router";
import { KeyRound as KeyRoundIcon, Share2 as ShareIcon } from "lucide";
import { FileSearch, KeyRound, Share2 } from "lucide-react";
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
import { trpc } from "@/utils/trpc";

type Props = {
  documentId?: string;
  username: string;
};

const formatDateTime = (date: Date | string | null): string => {
  if (!date) {
    return "never";
  }
  return new Date(date).toLocaleString();
};

export const AdminUserSupportPage: React.FC<Props> = ({
  documentId,
  username,
}) => {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [newPassword, setNewPassword] = useState("");
  const [shareLinksByDocumentId, setShareLinksByDocumentId] = useState<
    Record<string, string>
  >({});
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const userQuery = trpc.adminGetUserByUsername.useQuery(username, {
    enabled: !documentId,
    retry: false,
  });
  const userDocumentsQuery = trpc.adminListUserDocuments.useQuery(
    { username },
    {
      enabled: Boolean(userQuery.data && !documentId),
      retry: false,
    },
  );
  const selectedDocumentDetailsQuery =
    trpc.adminGetUserDocumentDetails.useQuery(
      {
        username,
        documentId: documentId ?? "",
      },
      {
        enabled: Boolean(documentId),
        retry: false,
      },
    );
  const resetPasswordMutation = trpc.adminResetUserPassword.useMutation();
  const createShareLinkMutation =
    trpc.adminCreateUserDocumentShareLink.useMutation();
  const drawingRuntimeConfig = createAccountWebRuntimeConfig();

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

      <nav className="account-actions" aria-label="Admin breadcrumbs">
        <Link to="/admin" className="ds-button">
          Admin search
        </Link>
        {documentId ? (
          <Link
            to="/admin/users/$username"
            params={{ username }}
            className="ds-button"
          >
            User page
          </Link>
        ) : null}
      </nav>

      {!documentId && userQuery.isFetching ? (
        <section className="account-card account-card--padded">
          <p className="account-muted">Loading user…</p>
        </section>
      ) : null}
      {!documentId && userQuery.data === null ? (
        <section className="account-card account-card--padded">
          <div className="account-alert" data-tone="danger" role="alert">
            <div className="account-alert__body">
              <div className="account-alert__title">User not found</div>
              <div>No account exists for {username}.</div>
            </div>
          </div>
        </section>
      ) : null}

      {!documentId && foundUser ? (
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
              disabled={!newPassword.trim() || resetPasswordMutation.isPending}
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

      {!documentId && foundUser ? (
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
                  <Link
                    className="ds-button"
                    data-selected={documentId === document.id}
                    to="/admin/users/$username/documents/$documentId"
                    params={{
                      username: foundUser.username,
                      documentId: document.id,
                    }}
                  >
                    <FileSearch className="account-action-icon" />
                    Inspect
                  </Link>
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

      {documentId ? (
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
