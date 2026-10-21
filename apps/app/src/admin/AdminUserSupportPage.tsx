import type { AccountShareMode } from "@smalldraw/shared";
import {
  KeyRound as KeyRoundIcon,
  LogOut as LogOutIcon,
  RotateCcw as RotateCcwIcon,
  Share2 as ShareIcon,
  Unplug as UnplugIcon,
} from "lucide";
import { FileSearch } from "lucide";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import {
  DeletedDrawingsList,
  type DeletedDrawingListItem,
} from "@/components/DeletedDrawingsList/DeletedDrawingsList";
import { buildInvitationUrl } from "@/components/DocumentInvitation/buildInvitationUrl";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import { DsThumbnailTile } from "@/components/DsThumbnailTile/DsThumbnailTile";
import { Icon } from "@/components/Icon";
import { useResource, useAction } from "@/hooks/useResource";
import { api } from "@/utils/api";
import {
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";

import { appPath } from "../config";

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
      <AdminDocumentInspectionPage
        documentId={documentId}
        username={username}
      />
    );
  }

  return <AdminUserOverviewPage username={username} />;
};

const AdminUserOverviewPage: React.FC<{ username: string }> = ({
  username,
}) => {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [newPassword, setNewPassword] = useState("");
  const [shareLinksByDocumentId, setShareLinksByDocumentId] = useState<
    Record<string, string>
  >({});
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [settingsShareMode, setSettingsShareMode] =
    useState<AccountShareMode>("allowed");
  const [settingsPin, setSettingsPin] = useState("");
  const [settingsClearPin, setSettingsClearPin] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const userQuery = useResource(
    (signal) => api.adminGetUserByUsername.query(username, { signal }),
    [username],
    {},
  );
  const userSessionsQuery = useResource(
    (signal) => api.adminListUserSessions.query({ username }, { signal }),
    [username],
    {
      enabled: Boolean(userQuery.data),
    },
  );
  const userDocumentsQuery = useResource(
    (signal) => api.adminListUserDocuments.query({ username }, { signal }),
    [username],
    {
      enabled: Boolean(userQuery.data),
    },
  );
  const deletedDocumentsQuery = useResource(
    (signal) =>
      api.adminListDeletedUserDocuments.query({ username }, { signal }),
    [username],
    {
      enabled: Boolean(userQuery.data),
    },
  );
  const accountSettingsQuery = useResource(
    (signal) => api.adminGetUserAccountSettings.query({ username }, { signal }),
    [username],
    {
      enabled: Boolean(userQuery.data),
    },
  );
  const resetPasswordMutation = useAction(api.adminResetUserPassword.mutate);
  const revokeSessionMutation = useAction(api.adminRevokeUserSession.mutate);
  const revokeSessionsMutation = useAction(api.adminRevokeUserSessions.mutate);
  const restoreDocumentMutation = useAction(
    api.adminRestoreUserDocument.mutate,
  );
  const createShareLinkMutation = useAction(
    api.adminCreateUserDocumentShareLink.mutate,
  );
  const saveAccountSettingsMutation = useAction(
    api.adminSaveUserAccountSettings.mutate,
  );
  const drawingRuntimeConfig = createAccountWebRuntimeConfig();
  const foundUser = userQuery.data;

  useEffect(() => {
    if (!accountSettingsQuery.data) {
      return;
    }
    setSettingsShareMode(accountSettingsQuery.data.shareMode);
    setSettingsPin("");
    setSettingsClearPin(false);
  }, [accountSettingsQuery.data]);

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
      await resetPasswordMutation.run({
        username: foundUser.username,
        newPassword,
      });
      setNewPassword("");
      setResetMessage(`Password reset for ${foundUser.username}.`);
      await userSessionsQuery.reload();
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
      const result = await revokeSessionMutation.run({
        username: foundUser.username,
        sessionId,
      });
      setSessionMessage(
        result.revoked === 1
          ? "Session revoked."
          : "That session was already gone.",
      );
      await userSessionsQuery.reload();
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
      const result = await revokeSessionsMutation.run({
        username: foundUser.username,
      });
      setSessionMessage(
        result.revoked === 1
          ? "1 session revoked."
          : `${result.revoked} sessions revoked.`,
      );
      await userSessionsQuery.reload();
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Sessions could not be revoked.",
      );
    }
  };

  const saveSettings = async () => {
    if (!foundUser) {
      return;
    }
    if (
      settingsShareMode === "pin_required" &&
      !settingsPin.trim() &&
      !accountSettingsQuery.data?.hasPin
    ) {
      setSettingsError("Set a PIN before requiring a PIN for sharing.");
      return;
    }
    setSettingsMessage(null);
    setSettingsError(null);
    try {
      await saveAccountSettingsMutation.run({
        username: foundUser.username,
        settings: {
          shareMode: settingsShareMode,
          pinChange: settingsPin.trim()
            ? { type: "set", pin: settingsPin.trim() }
            : settingsClearPin
              ? { type: "clear" }
              : { type: "unchanged" },
        },
      });
      setSettingsMessage("Settings saved.");
      setSettingsPin("");
      setSettingsClearPin(false);
      await accountSettingsQuery.reload();
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Settings could not be saved.",
      );
    }
  };

  const restoreDeletedDocument = async (document: DeletedDrawingListItem) => {
    if (!foundUser) {
      return;
    }
    const confirmed =
      (await confirmDialogRef.current?.confirm({
        title: "Restore drawing?",
        message: `This restores ${document.name} to ${foundUser.username}'s drawings.`,
        confirmLabel: "Restore",
        cancelLabel: "Cancel",
        icon: RotateCcwIcon,
      })) ?? false;
    if (!confirmed) {
      return;
    }

    setRestoreMessage(null);
    setRestoreError(null);
    try {
      await restoreDocumentMutation.run({
        username: foundUser.username,
        documentId: document.id,
      });
      setRestoreMessage(`${document.name} restored.`);
      await Promise.all([
        deletedDocumentsQuery.reload(),
        userDocumentsQuery.reload(),
      ]);
    } catch (error) {
      setRestoreError(
        error instanceof Error
          ? error.message
          : "Drawing could not be restored.",
      );
    }
  };

  return (
    <section className="admin-page" aria-label="Admin user support">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: appPath("admin") },
          { label: username },
        ]}
      />

      {userQuery.fetching ? (
        <section className="admin-panel">
          <p className="portal-muted">Loading user...</p>
        </section>
      ) : null}
      {userQuery.data === null ? (
        <section className="admin-panel">
          <div className="portal-alert" data-tone="danger" role="alert">
            <div className="portal-alert__body">
              <div className="portal-alert__title">User not found</div>
              <div>No account exists for {username}.</div>
            </div>
          </div>
        </section>
      ) : null}

      {foundUser ? (
        <>
          <section className="admin-panel">
            <header className="admin-panel__header">
              <h1 className="portal-title">{foundUser.username}</h1>
            </header>
            <div className="admin-section-grid">
              <section className="admin-section" aria-label="User details">
                <h2 className="portal-label">Account</h2>
                <dl className="portal-details">
                  <div>
                    <dt>User ID</dt>
                    <dd className="portal-code">{foundUser.id}</dd>
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
                <h2 className="portal-label">Recovery</h2>
                <form
                  className="portal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void resetPassword();
                  }}
                >
                  <input
                    className="portal-input portal-input--short"
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.currentTarget.value)
                    }
                    placeholder="New password"
                    aria-label="New password"
                  />
                  <button
                    type="submit"
                    className="ds-button"
                    data-tone="danger"
                    disabled={
                      !newPassword.trim() || resetPasswordMutation.pending
                    }
                  >
                    <Icon icon={KeyRoundIcon} className="portal-action-icon" />
                    Reset password
                  </button>
                </form>

                {resetMessage ? (
                  <div className="portal-alert" role="status">
                    <div className="portal-alert__body">
                      <div className="portal-alert__title">Password reset</div>
                      <div>{resetMessage}</div>
                    </div>
                  </div>
                ) : null}
                {resetError ? (
                  <div className="portal-alert" data-tone="danger" role="alert">
                    <div className="portal-alert__body">
                      <div className="portal-alert__title">Reset failed</div>
                      <div>{resetError}</div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="admin-section" aria-label="Sessions">
                <div className="admin-section__header">
                  <h2 className="portal-label">Sessions</h2>
                  <button
                    type="button"
                    className="ds-button"
                    data-tone="danger"
                    disabled={
                      !userSessionsQuery.data?.length ||
                      revokeSessionsMutation.pending
                    }
                    onClick={() => {
                      void revokeAllSessions();
                    }}
                  >
                    <Icon icon={LogOutIcon} className="portal-action-icon" />
                    Revoke all
                  </button>
                </div>
                {userSessionsQuery.loading ? (
                  <p className="portal-muted">Loading sessions...</p>
                ) : null}
                {userSessionsQuery.data?.length === 0 ? (
                  <p className="portal-muted">No active sessions.</p>
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
                          disabled={revokeSessionMutation.pending}
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
                      <div className="admin-record__meta portal-code">
                        Session ID: {formatSessionIdentifier(session.id)}
                      </div>
                    </div>
                  ))}
                </div>
                {sessionMessage ? (
                  <div className="portal-alert" role="status">
                    <div className="portal-alert__body">
                      <div className="portal-alert__title">
                        Sessions updated
                      </div>
                      <div>{sessionMessage}</div>
                    </div>
                  </div>
                ) : null}
                {sessionError ? (
                  <div className="portal-alert" data-tone="danger" role="alert">
                    <div className="portal-alert__body">
                      <div className="portal-alert__title">
                        Session update failed
                      </div>
                      <div>{sessionError}</div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="admin-section" aria-label="Settings">
                <h2 className="portal-label">Settings</h2>
                {accountSettingsQuery.loading ? (
                  <p className="portal-muted">Loading settings...</p>
                ) : null}
                <form
                  className="portal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSettings();
                  }}
                >
                  <select
                    className="portal-input portal-input--short"
                    value={settingsShareMode}
                    onChange={(event) =>
                      setSettingsShareMode(
                        event.currentTarget.value as AccountShareMode,
                      )
                    }
                    aria-label="Share mode"
                  >
                    <option value="allowed">Allow sharing</option>
                    <option value="pin_required">Allow sharing with PIN</option>
                    <option value="private_sync">Don’t allow sharing</option>
                  </select>
                  <input
                    className="portal-input portal-input--short"
                    placeholder={
                      accountSettingsQuery.data?.hasPin
                        ? "New PIN (optional)"
                        : "PIN (optional)"
                    }
                    type="password"
                    value={settingsPin}
                    onChange={(event) =>
                      setSettingsPin(event.currentTarget.value)
                    }
                    aria-label="New parental controls PIN"
                  />
                  {accountSettingsQuery.data?.hasPin ? (
                    <label className="portal-checkbox-field">
                      <input
                        checked={settingsClearPin}
                        className="portal-checkbox"
                        disabled={Boolean(settingsPin.trim())}
                        type="checkbox"
                        onChange={(event) =>
                          setSettingsClearPin(event.currentTarget.checked)
                        }
                      />
                      <span>Clear existing PIN</span>
                    </label>
                  ) : null}
                  <button
                    type="submit"
                    className="ds-button"
                    data-tone="primary"
                    disabled={saveAccountSettingsMutation.pending}
                  >
                    Save settings
                  </button>
                </form>
                {settingsMessage ? (
                  <div className="portal-alert" role="status">
                    <div className="portal-alert__body">
                      <div className="portal-alert__title">Settings saved</div>
                      <div>{settingsMessage}</div>
                    </div>
                  </div>
                ) : null}
                {settingsError ? (
                  <div className="portal-alert" data-tone="danger" role="alert">
                    <div className="portal-alert__body">
                      <div className="portal-alert__title">Settings failed</div>
                      <div>{settingsError}</div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </section>

          <section className="admin-panel">
            <header className="admin-panel__header">
              <h2 className="portal-title">Drawings</h2>
            </header>
            {userDocumentsQuery.loading ? (
              <p className="portal-muted">Loading drawings...</p>
            ) : null}
            {userDocumentsQuery.data?.length === 0 ? (
              <p className="portal-muted">This user has no shared drawings.</p>
            ) : null}
            <div className="portal-list">
              {userDocumentsQuery.data?.map((document) => {
                const shareLink = shareLinksByDocumentId[document.id];
                return (
                  <div key={document.id} className="portal-list-item">
                    <div className="portal-list-item__main">
                      <div>{document.name}</div>
                      <div className="portal-muted portal-muted--small portal-code">
                        {document.id}
                      </div>
                      {shareLink ? (
                        <input
                          className="portal-input portal-input--share"
                          readOnly
                          value={shareLink}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label={`Share link for ${document.name}`}
                        />
                      ) : null}
                    </div>
                    <AdminDocumentActions
                      beforeActions={
                        <a
                          className="ds-button"
                          href={appPath(
                            `admin/users/${encodeURIComponent(foundUser.username)}/documents/${encodeURIComponent(document.id)}`,
                          )}
                        >
                          <Icon
                            icon={FileSearch}
                            className="portal-action-icon"
                          />
                          Inspect
                        </a>
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
              <div className="portal-alert" data-tone="danger" role="alert">
                <div className="portal-alert__body">
                  <div className="portal-alert__title">Share link failed</div>
                  <div>{shareLinkError}</div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="admin-panel">
            <header className="admin-panel__header">
              <h2 className="portal-title">Deleted drawings</h2>
            </header>
            <DeletedDrawingsList
              documents={deletedDocumentsQuery.data ?? []}
              emptyLabel="No deleted drawings."
              isLoading={deletedDocumentsQuery.loading}
              layout="list"
              onRestore={(document) => {
                void restoreDeletedDocument(document);
              }}
              restoringId={
                restoreDocumentMutation.pending
                  ? (restoreDocumentMutation.input?.documentId ?? null)
                  : null
              }
            />
            {restoreMessage ? (
              <div className="portal-alert" role="status">
                <div className="portal-alert__body">
                  <div className="portal-alert__title">Drawing restored</div>
                  <div>{restoreMessage}</div>
                </div>
              </div>
            ) : null}
            {restoreError ? (
              <div className="portal-alert" data-tone="danger" role="alert">
                <div className="portal-alert__body">
                  <div className="portal-alert__title">Restore failed</div>
                  <div>{restoreError}</div>
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
  confirmDialogRef: React.RefObject<DsConfirmDialogHandle | null>;
  createShareLinkMutation: {
    run: typeof api.adminCreateUserDocumentShareLink.mutate;
    pending: boolean;
  };
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
  <div className="portal-form-row">
    {beforeActions}
    {shareLink ? (
      <input
        className="portal-input portal-input--share"
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
        disabled={createShareLinkMutation.pending}
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
            const result = await createShareLinkMutation.run({
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
        <Icon icon={ShareIcon} className="portal-action-icon" />
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
  const documentDetailsQuery = useResource(
    (signal) =>
      api.adminGetUserDocumentDetails.query(
        {
          username,
          documentId,
        },
        { signal },
      ),
    [username, documentId],
    {},
  );
  const createShareLinkMutation = useAction(
    api.adminCreateUserDocumentShareLink.mutate,
  );
  const revokeAccessTokenMutation = useAction(
    api.adminRevokeUserDocumentAccessToken.mutate,
  );
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
      const result = await revokeAccessTokenMutation.run({
        username,
        documentId,
        tokenId,
      });
      setTokenMessage(
        result.revoked
          ? "Device access revoked."
          : "That token could not be revoked.",
      );
      await documentDetailsQuery.reload();
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
          { label: "Admin", href: appPath("admin") },
          {
            label: username,
            href: appPath(`admin/users/${encodeURIComponent(username)}`),
          },
          { label: documentId },
        ]}
      />

      <section className="admin-panel">
        <header className="admin-panel__header">
          <h1 className="portal-title">Document inspection</h1>
          <p className="portal-muted portal-code">{documentId}</p>
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

        {documentDetailsQuery.loading ? (
          <p className="portal-muted">Loading document details...</p>
        ) : null}
        {documentDetailsQuery.error ? (
          <div className="portal-alert" data-tone="danger" role="alert">
            <div className="portal-alert__body">
              <div className="portal-alert__title">
                Document details could not be loaded
              </div>
              <div>{documentDetailsQuery.error.message}</div>
            </div>
          </div>
        ) : null}
        {details ? (
          <div className="admin-section-grid">
            <section className="admin-section" aria-label="Document details">
              <h2 className="portal-label">Drawing</h2>
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
              <dl className="portal-details">
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
              <h2 className="portal-label">Members</h2>
              <div className="admin-record-list">
                {details.members.length === 0 ? (
                  <p className="portal-muted">No members found.</p>
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
                    <div className="admin-record__meta portal-code">
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
              <h2 className="portal-label">Access tokens</h2>
              <div className="admin-record-list">
                {details.accessTokens.length === 0 ? (
                  <p className="portal-muted">
                    No owner or device tokens recorded.
                  </p>
                ) : null}
                {details.accessTokens.map((token) => (
                  <div key={token.id} className="admin-record">
                    <div className="admin-record__row">
                      <div className="admin-record__primary portal-code">
                        {token.scope}
                        {token.tag ? `:${token.tag}` : ""}
                      </div>
                      {token.scope === "device" && !token.revokedAt ? (
                        <button
                          type="button"
                          className="ds-button"
                          data-tone="danger"
                          disabled={revokeAccessTokenMutation.pending}
                          onClick={() => {
                            void revokeAccessToken({
                              tokenId: token.id,
                              tokenLabel: token.tag ?? token.id,
                            });
                          }}
                        >
                          <Icon
                            icon={UnplugIcon}
                            className="portal-action-icon"
                          />
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
                <div className="portal-alert" role="status">
                  <div className="portal-alert__body">
                    <div className="portal-alert__title">
                      Access token updated
                    </div>
                    <div>{tokenMessage}</div>
                  </div>
                </div>
              ) : null}
              {tokenError ? (
                <div className="portal-alert" data-tone="danger" role="alert">
                  <div className="portal-alert__body">
                    <div className="portal-alert__title">
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
          <div className="portal-alert" data-tone="danger" role="alert">
            <div className="portal-alert__body">
              <div className="portal-alert__title">Share link failed</div>
              <div>{shareLinkError}</div>
            </div>
          </div>
        ) : null}
      </section>
      <DsConfirmDialog ref={confirmDialogRef} />
    </section>
  );
};

type BreadcrumbItem = { label: string; href?: string };

const AdminBreadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <nav className="admin-toolbar" aria-label="Admin breadcrumbs">
    {items.map((item, index) => (
      <span key={`${item.label}-${index}`} className="admin-toolbar__item">
        {item.href ? (
          <a className="admin-toolbar__link" href={item.href}>
            {item.label}
          </a>
        ) : (
          <span className="admin-toolbar__current">{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);
