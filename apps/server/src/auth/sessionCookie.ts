const SESSION_COOKIE_NAME = "smalldraw_session";

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function parseSessionKeyFromCookieHeader(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const prefix = `${SESSION_COOKIE_NAME}=`;
  for (const entry of cookieHeader.split(";")) {
    const value = entry.trim();
    if (value.startsWith(prefix)) {
      const decoded = decodeURIComponent(value.slice(prefix.length));
      return decoded.length > 0 ? decoded : null;
    }
  }
  return null;
}

export function buildSessionCookie(sessionKey: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionKey)}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function buildClearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

type ResponseLike = {
  getHeader(name: string): number | string | string[] | undefined;
  setHeader(name: string, value: number | string | readonly string[]): void;
};

export function appendSetCookieHeader(
  res: ResponseLike | null | undefined,
  cookie: string,
): void {
  if (!res) {
    return;
  }
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", [cookie]);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookie]);
    return;
  }
  res.setHeader("Set-Cookie", [String(current), cookie]);
}
