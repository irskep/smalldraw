import * as opaque from "@serenity-kit/opaque";
import { useState } from "react";
import { trpc } from "../../utils/trpc";
import { type AuthResult, getAuthFailureMessage } from "../authErrors";
import { useLogin } from "../useLogin/useLogin";

type RegisterParams = {
  userIdentifier: string;
  password: string;
};

export const useRegisterAndLogin = () => {
  const [isPending, setIsPending] = useState(false);
  const registerStartMutation = trpc.registerStart.useMutation();
  const registerFinishMutation = trpc.registerFinish.useMutation();
  const { login } = useLogin();

  const registerAndLogin = async ({
    userIdentifier,
    password,
  }: RegisterParams) => {
    setIsPending(true);
    try {
      const { clientRegistrationState, registrationRequest } =
        opaque.client.startRegistration({ password });
      const { registrationResponse } = await registerStartMutation.mutateAsync({
        userIdentifier,
        registrationRequest,
      });

      const { registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password,
      });

      await registerFinishMutation.mutateAsync({
        userIdentifier,
        registrationRecord,
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
