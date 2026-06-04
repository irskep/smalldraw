import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { AuthForm } from "../components/AuthForm/AuthForm";
import { basePath } from "../config";
import { useRedirectIfAuthenticated } from "../hooks/useRedirectIfAuthenticated/useRedirectIfAuthenticated";
import { useRegisterAndLogin } from "../hooks/useRegisterAndLogin/useRegisterAndLogin";
import { authenticationSearchParams } from "../schema";

const Register = () => {
  const { registerAndLogin, isPending } = useRegisterAndLogin();
  const { redirect } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);

  useRedirectIfAuthenticated(redirect);

  return (
    <div className="account-page">
      <AuthForm
        onSubmit={async ({ password, username }) => {
          const success = await registerAndLogin({
            userIdentifier: username,
            password,
          });
          if (!success) {
            setError("Failed to register");
            return;
          }
          window.location.href = redirect || basePath;
        }}
        children="Sign up"
        isPending={isPending}
      />
      {error && (
        <div className="account-alert" data-tone="danger" role="alert">
          <AlertCircle className="account-alert__icon" />
          <div className="account-alert__body">
            <div className="account-alert__title">Error</div>
            <div>Failed to sign up</div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/register")({
  component: Register,
  validateSearch: authenticationSearchParams,
});
