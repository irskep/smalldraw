import { useEffect, useMemo } from "react";

import { basePath } from "@/config";
import { useAccount } from "@/utils/account";

const getSafeRedirectTarget = (redirect?: string) => {
  if (
    !redirect ||
    redirect.endsWith("/login") ||
    redirect.endsWith("/register")
  ) {
    return basePath;
  }

  return redirect;
};

export const useRedirectIfAuthenticated = (redirect?: string) => {
  const meQuery = useAccount();

  const safeRedirectTarget = useMemo(
    () => getSafeRedirectTarget(redirect),
    [redirect],
  );
  const shouldRedirect = Boolean(meQuery.data);

  useEffect(() => {
    if (shouldRedirect) {
      window.location.href = safeRedirectTarget;
    }
  }, [shouldRedirect, safeRedirectTarget]);
};
