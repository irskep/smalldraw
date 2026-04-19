import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    <div className="max-w-md mr-auto ml-auto">
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
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to sign up</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export const Route = createFileRoute("/register")({
  component: Register,
  validateSearch: authenticationSearchParams,
});
