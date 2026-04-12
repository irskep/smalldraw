export interface LocationLike {
  protocol: string;
  hostname: string;
}

export interface AccountWebRuntimeConfig {
  drawingAppBaseUrl: string;
}

export interface RuntimeEnvLike {
  VITE_DRAWING_APP_BASE_URL?: string;
}

export function createAccountWebRuntimeConfig(
  env: RuntimeEnvLike = import.meta.env as RuntimeEnvLike,
  location: LocationLike = window.location,
): AccountWebRuntimeConfig {
  return {
    drawingAppBaseUrl:
      normalizeOptionalBaseUrl(env.VITE_DRAWING_APP_BASE_URL) ??
      resolveDefaultDrawingAppBaseUrl(location),
  };
}

export function resolveDrawingAppBaseUrl(location: LocationLike): string {
  return resolveDefaultDrawingAppBaseUrl(location);
}

function resolveDefaultDrawingAppBaseUrl(location: LocationLike): string {
  return `${location.protocol}//${location.hostname}:3000`;
}

export function buildDrawingDocumentUrl(
  documentId: string,
  config: AccountWebRuntimeConfig = createAccountWebRuntimeConfig(),
): string {
  const url = new URL(config.drawingAppBaseUrl);
  url.searchParams.set("doc", documentId);
  return url.toString();
}

function normalizeOptionalBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.replace(/\/+$/, "") : null;
}
