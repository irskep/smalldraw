/** App base path. Always ends with "/". */
export const basePath = normalizeBasePath(import.meta.env.VITE_BASE);

/** Build an absolute path under the app's base, e.g. appPath("login") -> "/login" */
export function appPath(relative: string): string {
  return `${basePath}${relative}`;
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") {
    return "/";
  }
  return value.endsWith("/") ? value : `${value}/`;
}

/** Public pages must survive anonymous session-query failures. */
export function isPublicUnauthenticatedRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized.startsWith(appPath("coloringbook/")) ||
    ["", "coloringbook", "login", "register", "data", "privacy", "terms"].some(
      (route) => (appPath(route).replace(/\/+$/, "") || "/") === normalized,
    )
  );
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Let the browser load prerendered galleries as HTML rather than waiting for
// a lazy client route. Editor and server paths also bypass client navigation.
export function portalScope(origin: string, base = basePath) {
  return new RegExp(
    `^(?:${escapeRegExp(origin)})?${escapeRegExp(base)}(?!(?:coloringbook|draw|api|d|s)(?:[/#?]|$))`,
  );
}
