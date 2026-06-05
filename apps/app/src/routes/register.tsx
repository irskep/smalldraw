import { createFileRoute } from "@tanstack/react-router";
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
          setError(null);
          const result = await registerAndLogin({
            userIdentifier: username,
            password,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          window.location.href = redirect || basePath;
        }}
        children="Sign up"
        errorMessage={error}
        isPending={isPending}
      />
    </div>
  );
};

export const Route = createFileRoute("/register")({
  component: Register,
  validateSearch: authenticationSearchParams,
});
