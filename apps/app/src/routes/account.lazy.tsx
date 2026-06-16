import * as opaque from "@serenity-kit/opaque";
import { createLazyFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/utils/trpc";

export const AccountSettings = () => {
  const meQuery = trpc.me.useQuery();
  const changePasswordStartMutation = trpc.changePasswordStart.useMutation();
  const changePasswordFinishMutation = trpc.changePasswordFinish.useMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPending =
    changePasswordStartMutation.isPending ||
    changePasswordFinishMutation.isPending;

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
        password: currentPassword,
      });
      const { clientRegistrationState, registrationRequest } =
        opaque.client.startRegistration({ password: newPassword });

      const { loginResponse, registrationResponse } =
        await changePasswordStartMutation.mutateAsync({
          currentPasswordLoginRequest: startLoginRequest,
          newPasswordRegistrationRequest: registrationRequest,
        });

      const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse,
        password: currentPassword,
      });
      if (!loginResult) {
        setError("The current password is incorrect.");
        return;
      }

      const { registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password: newPassword,
      });
      const result = await changePasswordFinishMutation.mutateAsync({
        currentPasswordFinishRequest: loginResult.finishLoginRequest,
        newPasswordRegistrationRecord: registrationRecord,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        result.sessionsRevoked > 0
          ? "Password changed. Other sessions were signed out."
          : "Password changed.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Password could not be changed.",
      );
    }
  };

  return (
    <section className="portal-page" aria-label="Account settings">
      <div className="portal-page__header">
        <h1 className="portal-title">Account</h1>
      </div>

      <section className="portal-card portal-card--padded">
        <dl className="portal-details">
          <div>
            <dt>Username</dt>
            <dd>
              {meQuery.data?.username ?? "Loading..."}
              {meQuery.data?.isServerAdmin ? " (admin)" : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="portal-card portal-card--padded">
        <h2 className="portal-title">Change password</h2>
        <form className="portal-form" onSubmit={changePassword}>
          {message ? (
            <div className="portal-alert" role="status">
              <div className="portal-alert__body">
                <div className="portal-alert__title">Password changed</div>
                <div>{message}</div>
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="portal-alert" data-tone="danger" role="alert">
              <AlertCircle className="portal-alert__icon" />
              <div className="portal-alert__body">
                <div className="portal-alert__title">
                  Could not change password
                </div>
                <div>{error}</div>
              </div>
            </div>
          ) : null}

          <div className="portal-form-field">
            <input
              required
              autoComplete="current-password"
              className="portal-input"
              name="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              type="password"
              value={currentPassword}
            />
            <input
              required
              autoComplete="new-password"
              className="portal-input"
              name="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              type="password"
              value={newPassword}
            />
            <input
              required
              autoComplete="new-password"
              className="portal-input"
              name="confirm-new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              type="password"
              value={confirmPassword}
            />
          </div>

          <button
            type="submit"
            className="ds-button"
            data-tone="primary"
            disabled={isPending || meQuery.isLoading}
          >
            Change password
          </button>
        </form>
      </section>
    </section>
  );
};

export const Route = createLazyFileRoute("/account")({
  component: AccountSettings,
});
