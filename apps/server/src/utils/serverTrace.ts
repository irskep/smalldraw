/** Opt-in high-volume diagnostics; warnings and errors always retain their normal sinks. */
export function createServerTrace(
  enabled: boolean,
  write: (...args: unknown[]) => void = console.info,
) {
  return enabled
    ? (event: string, details: unknown) => write(event, details)
    : (_event: string, _details: unknown) => {};
}
export const serverTrace = createServerTrace(
  process.env.SMALLDRAW_SERVER_TRACE === "1",
);
