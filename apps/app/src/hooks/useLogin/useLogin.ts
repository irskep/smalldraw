import { rememberAccountLogin } from "@smalldraw/splat/account";
import { useState } from "react";
import { api } from "@/utils/api";
import { type AuthResult, getAuthFailureMessage } from "../authErrors";

type LoginParams = {
  userIdentifier: string;
  password: string;
};

export const useLogin = () => {
  const [isPending, setIsPending] = useState(false);

  const login = async ({ userIdentifier, password }: LoginParams) => {
    setIsPending(true);
    try {
      const opaque = await import("@serenity-kit/opaque");
      await opaque.ready;
      const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
        password,
      });

      const { loginResponse } = await api.loginStart.mutate({
        userIdentifier,
        startLoginRequest,
      });

      const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse,
        password,
      });
      if (!loginResult) {
        return {
          ok: false,
          message: "The username or password is incorrect.",
        } satisfies AuthResult;
      }
      const { finishLoginRequest } = loginResult;

      const { success, userId } = await api.loginFinish.mutate({
        finishLoginRequest,
        userIdentifier,
      });

      if (success) rememberAccountLogin(userId);

      return success
        ? ({ ok: true } satisfies AuthResult)
        : ({
            ok: false,
            message: "The username or password is incorrect.",
          } satisfies AuthResult);
    } catch (error) {
      return {
        ok: false,
        message: getAuthFailureMessage(error, "login"),
      } satisfies AuthResult;
    } finally {
      setIsPending(false);
    }
  };
  return { isPending, login };
};
