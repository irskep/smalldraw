import { useLocation } from "preact-iso";
import { useState } from "react";
import { AuthForm } from "../components/AuthForm/AuthForm";
import { basePath } from "../config";
import { useRedirectIfAuthenticated } from "../hooks/useRedirectIfAuthenticated/useRedirectIfAuthenticated";
import { useRegisterAndLogin } from "../hooks/useRegisterAndLogin/useRegisterAndLogin";

const Register = () => {
  const { registerAndLogin, isPending } = useRegisterAndLogin();
  const { redirect } = useLocation().query;
  const [error, setError] = useState<string | null>(null);

  useRedirectIfAuthenticated(redirect);

  return (
    <div className="portal-page">
      <AuthForm
        onSubmit={async ({ initialSettings, password, username }) => {
          setError(null);
          const result = await registerAndLogin({
            userIdentifier: username,
            password,
            initialSettings,
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
        requireAgeConfirmation
      />
    </div>
  );
};

export default Register;
