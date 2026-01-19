import { useEffect, useMemo } from "react";
import { trpc } from "@/utils/trpc";

const authRoutes = new Set(["/login", "/register"]);

const getSafeRedirectTarget = (redirect?: string) => {
  if (!redirect || authRoutes.has(redirect)) {
    return "/";
  }

  return redirect;
};

export const useRedirectIfAuthenticated = (redirect?: string) => {
  const meQuery = trpc.me.useQuery(undefined, {
    retry: (failureCount, error) => {
      const errorCode = error?.data?.code;
      if (errorCode === "UNAUTHORIZED") {
        return false;
      }
      if (failureCount > 3) return false;
      return true;
    },
  });

  const safeRedirectTarget = useMemo(
    () => getSafeRedirectTarget(redirect),
    [redirect],
  );
  const shouldRedirect = meQuery.isSuccess && Boolean(meQuery.data);

  useEffect(() => {
    if (shouldRedirect) {
      window.location.href = safeRedirectTarget;
    }
  }, [shouldRedirect, safeRedirectTarget]);
};
