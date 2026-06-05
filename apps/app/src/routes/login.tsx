import { createFileRoute } from "@tanstack/react-router";
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
          setError(null);
          const result = await login({
            userIdentifier: username,
            password,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          window.location.href = redirect || basePath;
        }}
        children="Login"
        errorMessage={error}
        isPending={isPending}
      />
    </div>
  );
};

export const Route = createFileRoute("/login")({
  component: Login,
  validateSearch: authenticationSearchParams,
});
