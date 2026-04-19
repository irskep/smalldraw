/** App base path, e.g. "/" in dev or "/account/" in prod. Always ends with "/". */
export const basePath = import.meta.env.VITE_BASE;

/** Build an absolute path under the app's base, e.g. appPath("login") → "/account/login" */
export function appPath(relative: string): string {
  return `${basePath}${relative}`;
}

/** Check if the current pathname matches a route under the app's base */
export function isAppRoute(route: string): boolean {
  return window.location.pathname === appPath(route);
}
