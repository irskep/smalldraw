import { Link } from "@tanstack/react-router";
import {
  KeyRound as KeyRoundIcon,
  LogOut as LogOutIcon,
  Share2 as ShareIcon,
  Unplug as UnplugIcon,
} from "lucide";
import { FileSearch, KeyRound, LogOut, Share2, Unplug } from "lucide-react";
import { useRef, useState } from "react";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import { buildInvitationUrl } from "@/components/DocumentInvitation/buildInvitationUrl";
import { DsThumbnailTile } from "@/components/DsThumbnailTile/DsThumbnailTile";
import {
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";
import { trpc } from "@/utils/trpc";

type Props = {
  documentId?: string;
  username: string;
};

type AdminDocumentActionTarget = {
  currentAdminHasAccess: boolean;
  id: string;
  name: string;
};

const formatDateTime = (date: Date | string | null): string => {
  if (!date) {
    return "never";
  }
  return new Date(date).toLocaleString();
};

const formatSessionIdentifier = (sessionId: string): string =>
  `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;

export const AdminUserSupportPage: React.FC<Props> = ({
  documentId,
  username,
}) => {
  if (documentId) {
    return (
      <AdminDocumentInspectionPage documentId={documentId} username={username} />
    );
  }

  return <AdminUserOverviewPage username={username} />;
};

const AdminUserOverviewPage: React.FC<{ username: string }> = ({ username }) => {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [newPassword, setNewPassword] = useState("");
  const [shareLinksByDocumentId, setShareLinksByDocumentId] = useState<
    Record<string, string>
  >({});
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const trpcUtils = trpc.useUtils();
  const userQuery = trpc.adminGetUserByUsername.useQuery(username, {
    retry: false,
  });
  const userSessionsQuery = trpc.adminListUserSessions.useQuery(
    { username },
    {
      enabled: Boolean(userQuery.data),
      retry: false,
    },
  );
  const userDocumentsQuery = trpc.adminListUserDocuments.useQuery(
    { username },
    {
      enabled: Boolean(userQuery.data),
      retry: false,
    },
  );
  const resetPasswordMutation = trpc.adminResetUserPassword.useMutation();
  const revokeSessionMutation = trpc.adminRevokeUserSession.useMutation();
  const revokeSessionsMutation = trpc.adminRevokeUserSessions.useMutation();
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
      await trpcUtils.adminListUserSessions.invalidate({
        username: foundUser.username,
      });
    } catch (error) {
      setResetError(
        error instanceof Error
          ? error.message
          : "Password reset failed. Please try again.",
      );
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!foundUser) {
      return;
    }
    const confirmed =
      (await confirmDialogRef.current?.confirm({
        title: "Revoke session?",
        message: `This signs ${foundUser.username} out of this session.`,
        confirmLabel: "Revoke session",
        cancelLabel: "Cancel",
        tone: "danger",
        icon: LogOutIcon,
      })) ?? false;
    if (!confirmed) {
      return;
    }

    setSessionMessage(null);
    setSessionError(null);
    try {
      const result = await revokeSessionMutation.mutateAsync({
        username: foundUser.username,
        sessionId,
      });
      setSessionMessage(
        result.revoked === 1
          ? "Session revoked."
          : "That session was already gone.",
      );
      await trpcUtils.adminListUserSessions.invalidate({
        username: foundUser.username,
      });
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Session could not be revoked.",
      );
    }
  };

  const revokeAllSessions = async () => {
    if (!foundUser) {
      return;
    }
    const confirmed =
      (await confirmDialogRef.current?.confirm({
        title: "Revoke all sessions?",
        message: `This signs ${foundUser.username} out everywhere, including the current browser if this is your account.`,
        confirmLabel: "Revoke all",
        cancelLabel: "Cancel",
        tone: "danger",
        icon: LogOutIcon,
      })) ?? false;
    if (!confirmed) {
      return;
    }

    setSessionMessage(null);
    setSessionError(null);
    try {
      const result = await revokeSessionsMutation.mutateAsync({
        username: foundUser.username,
      });
      setSessionMessage(
        result.revoked === 1
          ? "1 session revoked."
          : `${result.revoked} sessions revoked.`,
      );
      await trpcUtils.adminListUserSessions.invalidate({
        username: foundUser.username,
      });
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Sessions could not be revoked.",
      );
    }
  };

  return (
    <section className="admin-page" aria-label="Admin user support">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", to: "/admin" },
          { label: username },
        ]}
      />

      {userQuery.isFetching ? (
        <section className="admin-panel">
          <p className="account-muted">Loading user...</p>
        </section>
      ) : null}
      {userQuery.data === null ? (
        <section className="admin-panel">
          <div className="account-alert" data-tone="danger" role="alert">
            <div className="account-alert__body">
              <div className="account-alert__title">User not found</div>
              <div>No account exists for {username}.</div>
            </div>
          </div>
        </section>
      ) : null}

      {foundUser ? (
        <>
          <section className="admin-panel">
            <header className="admin-panel__header">
              <h1 className="account-title">{foundUser.username}</h1>
            </header>
            <div className="admin-section-grid">
              <section className="admin-section" aria-label="User details">
                <h2 className="account-label">Account</h2>
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
              </section>

              <section className="admin-section" aria-label="Password reset">
                <h2 className="account-label">Recovery</h2>
                <form
                  className="account-form"
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

              <section className="admin-section" aria-label="Sessions">
                <div className="admin-section__header">
                  <h2 className="account-label">Sessions</h2>
                  <button
                    type="button"
                    className="ds-button"
                    data-tone="danger"
                    disabled={
                      !userSessionsQuery.data?.length ||
                      revokeSessionsMutation.isPending
                    }
                    onClick={() => {
                      void revokeAllSessions();
                    }}
                  >
                    <LogOut className="account-action-icon" />
                    Revoke all
                  </button>
                </div>
                {userSessionsQuery.isLoading ? (
                  <p className="account-muted">Loading sessions...</p>
                ) : null}
                {userSessionsQuery.data?.length === 0 ? (
                  <p className="account-muted">No active sessions.</p>
                ) : null}
                <div className="admin-record-list">
                  {userSessionsQuery.data?.map((session) => (
                    <div key={session.id} className="admin-record">
                      <div className="admin-record__row">
                        <div className="admin-record__primary">
                          {session.isCurrentAdminSession
                            ? "Current admin session"
                            : "Session"}
                        </div>
                        <button
                          type="button"
                          className="ds-button"
                          data-tone="danger"
                          disabled={revokeSessionMutation.isPending}
                          onClick={() => {
                            void revokeSession(session.id);
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                      <div className="admin-record__meta">
                        Created: {formatDateTime(session.createdAt)}
                      </div>
                      <div className="admin-record__meta account-code">
                        Session ID: {formatSessionIdentifier(session.id)}
                      </div>
                    </div>
                  ))}
                </div>
                {sessionMessage ? (
                  <div className="account-alert" role="status">
                    <div className="account-alert__body">
                      <div className="account-alert__title">
                        Sessions updated
                      </div>
                      <div>{sessionMessage}</div>
                    </div>
                  </div>
                ) : null}
                {sessionError ? (
                  <div className="account-alert" data-tone="danger" role="alert">
                    <div className="account-alert__body">
                      <div className="account-alert__title">
                        Session update failed
                      </div>
                      <div>{sessionError}</div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </section>

          <section className="admin-panel">
            <header className="admin-panel__header">
              <h2 className="account-title">Drawings</h2>
            </header>
            {userDocumentsQuery.isLoading ? (
              <p className="account-muted">Loading drawings...</p>
            ) : null}
            {userDocumentsQuery.data?.length === 0 ? (
              <p className="account-muted">This user has no shared drawings.</p>
            ) : null}
            <div className="account-list">
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
                    <AdminDocumentActions
                      beforeActions={
                        <Link
                          className="ds-button"
                          to="/admin/users/$username/documents/$documentId"
                          params={{
                            username: foundUser.username,
                            documentId: document.id,
                          }}
                        >
                          <FileSearch className="account-action-icon" />
                          Inspect
                        </Link>
                      }
                      confirmDialogRef={confirmDialogRef}
                      createShareLinkMutation={createShareLinkMutation}
                      document={document}
                      drawingRuntimeConfig={drawingRuntimeConfig}
                      shareLink={shareLink}
                      setShareLink={setShareLinkForDocument}
                      setShareLinkError={setShareLinkError}
                      username={foundUser.username}
                    />
                  </div>
                );
              })}
            </div>
            {shareLinkError ? (
              <div className="account-alert" data-tone="danger" role="alert">
                <div className="account-alert__body">
                  <div className="account-alert__title">Share link failed</div>
                  <div>{shareLinkError}</div>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <DsConfirmDialog ref={confirmDialogRef} />
    </section>
  );

  function setShareLinkForDocument(documentId: string, shareLink: string) {
    setShareLinksByDocumentId((current) => ({
      ...current,
      [documentId]: shareLink,
    }));
  }
};

type AdminDocumentActionsProps = {
  beforeActions?: React.ReactNode;
  confirmDialogRef: React.RefObject<DsConfirmDialogHandle>;
  createShareLinkMutation: ReturnType<
    typeof trpc.adminCreateUserDocumentShareLink.useMutation
  >;
  document: AdminDocumentActionTarget;
  drawingRuntimeConfig: ReturnType<typeof createAccountWebRuntimeConfig>;
  shareLink?: string;
  setShareLink: (documentId: string, shareLink: string) => void;
  setShareLinkError: (message: string | null) => void;
  username: string;
};

const AdminDocumentActions: React.FC<AdminDocumentActionsProps> = ({
  beforeActions,
  confirmDialogRef,
  createShareLinkMutation,
  document,
  drawingRuntimeConfig,
  shareLink,
  setShareLink,
  setShareLinkError,
  username,
}) => (
  <div className="account-form-row">
    {beforeActions}
    {shareLink ? (
      <input
        className="account-input account-input--share"
        readOnly
        value={shareLink}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={`Share link for ${document.name}`}
      />
    ) : null}
    {document.currentAdminHasAccess ? (
      <a
        className="ds-button"
        href={buildDrawingDocumentUrl(document.id, drawingRuntimeConfig)}
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
            const result = await createShareLinkMutation.mutateAsync({
              username,
              documentId: document.id,
            });
            setShareLink(document.id, buildInvitationUrl(result.token));
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
);

const AdminDocumentInspectionPage: React.FC<{
  documentId: string;
  username: string;
}> = ({ documentId, username }) => {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [shareLink, setShareLink] = useState<string | undefined>();
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const trpcUtils = trpc.useUtils();
  const documentDetailsQuery = trpc.adminGetUserDocumentDetails.useQuery(
    {
      username,
      documentId,
    },
    {
      retry: false,
    },
  );
  const createShareLinkMutation =
    trpc.adminCreateUserDocumentShareLink.useMutation();
  const revokeAccessTokenMutation =
    trpc.adminRevokeUserDocumentAccessToken.useMutation();
  const drawingRuntimeConfig = createAccountWebRuntimeConfig();
  const details = documentDetailsQuery.data;

  const revokeAccessToken = async ({
    tokenId,
    tokenLabel,
  }: {
    tokenId: string;
    tokenLabel: string;
  }) => {
    const confirmed =
      (await confirmDialogRef.current?.confirm({
        title: "Revoke device access?",
        message: `This stops ${tokenLabel} from opening or syncing this drawing with its current device token.`,
        confirmLabel: "Revoke access",
        cancelLabel: "Cancel",
        tone: "danger",
        icon: UnplugIcon,
      })) ?? false;
    if (!confirmed) {
      return;
    }

    setTokenMessage(null);
    setTokenError(null);
    try {
      const result = await revokeAccessTokenMutation.mutateAsync({
        username,
        documentId,
        tokenId,
      });
      setTokenMessage(
        result.revoked
          ? "Device access revoked."
          : "That token could not be revoked.",
      );
      await trpcUtils.adminGetUserDocumentDetails.invalidate({
        username,
        documentId,
      });
    } catch (error) {
      setTokenError(
        error instanceof Error
          ? error.message
          : "Device access could not be revoked.",
      );
    }
  };

  return (
    <section className="admin-page" aria-label="Admin document inspection">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", to: "/admin" },
          {
            label: username,
            to: "/admin/users/$username",
            params: { username },
          },
          { label: documentId },
        ]}
      />

      <section className="admin-panel">
        <header className="admin-panel__header">
          <h1 className="account-title">Document inspection</h1>
          <p className="account-muted account-code">{documentId}</p>
          {details ? (
            <AdminDocumentActions
              confirmDialogRef={confirmDialogRef}
              createShareLinkMutation={createShareLinkMutation}
              document={details.document}
              drawingRuntimeConfig={drawingRuntimeConfig}
              shareLink={shareLink}
              setShareLink={(_, nextShareLink) => setShareLink(nextShareLink)}
              setShareLinkError={setShareLinkError}
              username={username}
            />
          ) : null}
        </header>

        {documentDetailsQuery.isLoading ? (
          <p className="account-muted">Loading document details...</p>
        ) : null}
        {documentDetailsQuery.error ? (
          <div className="account-alert" data-tone="danger" role="alert">
            <div className="account-alert__body">
              <div className="account-alert__title">
                Document details could not be loaded
              </div>
              <div>{documentDetailsQuery.error.message}</div>
            </div>
          </div>
        ) : null}
        {details ? (
          <div className="admin-section-grid">
            <section className="admin-section" aria-label="Document details">
              <h2 className="account-label">Drawing</h2>
              <div className="admin-thumbnail">
                <DsThumbnailTile
                  badge={null}
                  emptyLabel="No preview"
                  imageAlt={`${details.document.name} thumbnail`}
                  imageSrc={details.document.thumbnailUrl ?? undefined}
                  onOpen={() => {
                    if (details.document.currentAdminHasAccess) {
                      window.location.href = buildDrawingDocumentUrl(
                        details.document.id,
                        drawingRuntimeConfig,
                      );
                    }
                  }}
                  openDisabled={!details.document.currentAdminHasAccess}
                  openLabel={`Open ${details.document.name}`}
                />
              </div>
              <dl className="account-details">
                <div>
                  <dt>Name</dt>
                  <dd>{details.document.name}</dd>
                </div>
                <div>
                  <dt>Target user role</dt>
                  <dd>
                    {details.document.isAdmin ? "Document admin" : "Member"}
                  </dd>
                </div>
                <div>
                  <dt>Viewing admin access</dt>
                  <dd>
                    {details.document.currentAdminHasAccess
                      ? "Already has access"
                      : "No membership"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="admin-section" aria-label="Members">
              <h2 className="account-label">Members</h2>
              <div className="admin-record-list">
                {details.members.length === 0 ? (
                  <p className="account-muted">No members found.</p>
                ) : null}
                {details.members.map((member) => (
                  <div key={member.id} className="admin-record">
                    <div className="admin-record__row">
                      <div className="admin-record__primary">
                        {member.username}
                      </div>
                      <div className="admin-record__meta">
                        {member.isAdmin ? "document admin" : "member"}
                      </div>
                    </div>
                    <div className="admin-record__meta account-code">
                      {member.id}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="admin-section admin-section--wide"
              aria-label="Access tokens"
            >
              <h2 className="account-label">Access tokens</h2>
              <div className="admin-record-list">
                {details.accessTokens.length === 0 ? (
                  <p className="account-muted">
                    No owner or device tokens recorded.
                  </p>
                ) : null}
                {details.accessTokens.map((token) => (
                  <div key={token.id} className="admin-record">
                    <div className="admin-record__row">
                      <div className="admin-record__primary account-code">
                        {token.scope}
                        {token.tag ? `:${token.tag}` : ""}
                      </div>
                      {token.scope === "device" && !token.revokedAt ? (
                        <button
                          type="button"
                          className="ds-button"
                          data-tone="danger"
                          disabled={revokeAccessTokenMutation.isPending}
                          onClick={() => {
                            void revokeAccessToken({
                              tokenId: token.id,
                              tokenLabel: token.tag ?? token.id,
                            });
                          }}
                        >
                          <Unplug className="account-action-icon" />
                          Revoke
                        </button>
                      ) : (
                        <div className="admin-record__meta">
                          {token.revokedAt ? "revoked" : "active"}
                        </div>
                      )}
                    </div>
                    <div className="admin-record__meta">
                      Created: {formatDateTime(token.createdAt)}
                    </div>
                    <div className="admin-record__meta">
                      Last used: {formatDateTime(token.lastUsedAt)}
                    </div>
                  </div>
                ))}
              </div>
              {tokenMessage ? (
                <div className="account-alert" role="status">
                  <div className="account-alert__body">
                    <div className="account-alert__title">
                      Access token updated
                    </div>
                    <div>{tokenMessage}</div>
                  </div>
                </div>
              ) : null}
              {tokenError ? (
                <div className="account-alert" data-tone="danger" role="alert">
                  <div className="account-alert__body">
                    <div className="account-alert__title">
                      Access token update failed
                    </div>
                    <div>{tokenError}</div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
        {shareLinkError ? (
          <div className="account-alert" data-tone="danger" role="alert">
            <div className="account-alert__body">
              <div className="account-alert__title">Share link failed</div>
              <div>{shareLinkError}</div>
            </div>
          </div>
        ) : null}
      </section>
      <DsConfirmDialog ref={confirmDialogRef} />
    </section>
  );
};

type BreadcrumbItem =
  | { label: string; to?: undefined; params?: undefined }
  | { label: string; to: "/admin"; params?: undefined }
  | {
      label: string;
      to: "/admin/users/$username";
      params: { username: string };
    };

const AdminBreadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <nav className="admin-toolbar" aria-label="Admin breadcrumbs">
    {items.map((item, index) => (
      <span key={`${item.label}-${index}`} className="admin-toolbar__item">
        {item.to ? (
          <Link
            className="admin-toolbar__link"
            to={item.to}
            params={item.params}
          >
            {item.label}
          </Link>
        ) : (
          <span className="admin-toolbar__current">{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);
