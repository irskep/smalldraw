import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { AuthForm } from "../components/AuthForm/AuthForm.js";
import { basePath } from "../config.js";
import { useRedirectIfAuthenticated } from "../hooks/useRedirectIfAuthenticated/useRedirectIfAuthenticated";
import { useLogin } from "../hooks/useLogin/useLogin.js";
import { authenticationSearchParams } from "../schema.js";

const Login = () => {
  const { login, isPending } = useLogin();
  const { redirect } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);

  useRedirectIfAuthenticated(redirect);

  return (
    <div className="account-page">
      <AuthForm
        onSubmit={async ({ password, username }) => {
          const success = await login({
            userIdentifier: username,
            password,
          });
          if (!success) {
            setError("Failed to login");
            return;
          }
          window.location.href = redirect || basePath;
        }}
        children="Login"
        isPending={isPending}
      />
      {error && (
        <div className="account-alert" data-tone="danger" role="alert">
          <AlertCircle className="account-alert__icon" />
          <div className="account-alert__body">
            <div className="account-alert__title">Error</div>
            <div>Failed to log in</div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/login")({
  component: Login,
  validateSearch: authenticationSearchParams,
});
