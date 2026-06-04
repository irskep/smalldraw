/** App base path. Always ends with "/". */
export const basePath = normalizeBasePath(import.meta.env.VITE_BASE);

/** Build an absolute path under the app's base, e.g. appPath("login") -> "/login" */
export function appPath(relative: string): string {
  return `${basePath}${relative}`;
}

/** Check if the current pathname matches a route under the app's base */
export function isAppRoute(route: string): boolean {
  return window.location.pathname === appPath(route);
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") {
    return "/";
  }
  return value.endsWith("/") ? value : `${value}/`;
}
