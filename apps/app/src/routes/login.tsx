import { useLocation } from "preact-iso";
import { useState } from "react";
import { AuthForm } from "../components/AuthForm/AuthForm.js";
import { basePath } from "../config.js";
import { useRedirectIfAuthenticated } from "../hooks/useRedirectIfAuthenticated/useRedirectIfAuthenticated";
import { useLogin } from "../hooks/useLogin/useLogin.js";

const Login = () => {
  const { login, isPending } = useLogin();
  const { redirect } = useLocation().query;
  const [error, setError] = useState<string | null>(null);

  useRedirectIfAuthenticated(redirect);

  return (
    <div className="portal-page">
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

export default Login;
