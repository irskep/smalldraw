export interface SavePngExportRequest {
  suggestedName: string;
  bytesBase64: string;
}

export interface SavePngExportResponse {
  saved: boolean;
  path?: string;
}
