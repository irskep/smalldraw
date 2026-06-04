import {
  buildDrawingAppUrl,
  resolveDrawingAppBaseUrl as resolveSharedDrawingAppBaseUrl,
} from "@smalldraw/shared";

export interface LocationLike {
  protocol: string;
  host: string;
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
  return resolveSharedDrawingAppBaseUrl(
    `${location.protocol}//${location.host}`,
  );
}

export function buildDrawingDocumentUrl(
  documentId: string,
  config: AccountWebRuntimeConfig = createAccountWebRuntimeConfig(),
): string {
  return buildDrawingAppUrl(config.drawingAppBaseUrl, {
    type: "account",
    documentId,
  });
}

function normalizeOptionalBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0
    ? resolveSharedDrawingAppBaseUrl(trimmed)
    : null;
}
