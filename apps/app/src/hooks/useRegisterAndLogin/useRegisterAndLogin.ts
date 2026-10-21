import type { AccountSettingsInput } from "@smalldraw/shared";
import { useState } from "react";
import { api } from "@/utils/api";
import { type AuthResult, getAuthFailureMessage } from "../authErrors";
import { useLogin } from "../useLogin/useLogin";

type RegisterParams = {
  userIdentifier: string;
  password: string;
  initialSettings?: AccountSettingsInput;
};

export const useRegisterAndLogin = () => {
  const [isPending, setIsPending] = useState(false);
  const { login } = useLogin();

  const registerAndLogin = async ({
    initialSettings,
    userIdentifier,
    password,
  }: RegisterParams) => {
    setIsPending(true);
    try {
      const opaque = await import("@serenity-kit/opaque");
      await opaque.ready;
      const { clientRegistrationState, registrationRequest } =
        opaque.client.startRegistration({ password });
      const { registrationResponse } = await api.registerStart.mutate({
        userIdentifier,
        registrationRequest,
      });

      const { registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password,
      });

      await api.registerFinish.mutate({
        userIdentifier,
        registrationRecord,
        initialSettings,
      });

      const loginResult = await login({ userIdentifier, password });
      return loginResult.ok
        ? ({ ok: true } satisfies AuthResult)
        : ({
            ok: false,
            message: "Account was created, but login failed. Try logging in.",
          } satisfies AuthResult);
    } catch (error) {
      return {
        ok: false,
        message: getAuthFailureMessage(error, "register"),
      } satisfies AuthResult;
    } finally {
      setIsPending(false);
    }
  };

  return { isPending, registerAndLogin };
};
