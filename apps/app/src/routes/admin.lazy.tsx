import { createLazyFileRoute } from "@tanstack/react-router";
import { KeyRound as KeyRoundIcon } from "lucide";
import { KeyRound, Search } from "lucide-react";
import { useRef, useState } from "react";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import { trpc } from "../utils/trpc";

const Admin = () => {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [lookupUsername, setLookupUsername] = useState("");
  const [submittedUsername, setSubmittedUsername] = useState<string | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const meQuery = trpc.me.useQuery();
  const userQuery = trpc.adminGetUserByUsername.useQuery(
    submittedUsername ?? "",
    {
      enabled: Boolean(submittedUsername),
      retry: false,
    },
  );
  const resetPasswordMutation = trpc.adminResetUserPassword.useMutation();

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
            setSubmittedUsername(username);
          }}
        >
          <input
            className="account-input account-input--short"
            value={lookupUsername}
            onChange={(event) => setLookupUsername(event.target.value)}
            placeholder="Username"
            aria-label="User lookup"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            inputMode="search"
            name="admin-user-lookup"
            spellCheck={false}
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

      <DsConfirmDialog ref={confirmDialogRef} />
    </section>
  );
};

export const Route = createLazyFileRoute("/admin")({
  component: Admin,
});
