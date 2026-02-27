export type DiagnosticLogLevel = "info" | "warn" | "error";

export interface DiagnosticLogEntry {
  sequence: number;
  timestamp: string;
  event: string;
  level: DiagnosticLogLevel;
  metadata?: Record<string, unknown>;
}

const DIAGNOSTIC_LOG_KEY = "__smalldrawDiagnosticLog";
const DIAGNOSTIC_LOG_CAPACITY = 2000;
const DIAGNOSTIC_LOG_SEQUENCE_KEY = "__smalldrawDiagnosticLogSequence";

const contextStack: Array<Record<string, unknown>> = [];
let helpersInstalled = false;

function isProductionBuild(): boolean {
  if (typeof process === "undefined") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function getLogBuffer(): DiagnosticLogEntry[] {
  const target = globalThis as Record<string, unknown>;
  const existing = target[DIAGNOSTIC_LOG_KEY];
  if (Array.isArray(existing)) {
    return existing as DiagnosticLogEntry[];
  }
  const created: DiagnosticLogEntry[] = [];
  target[DIAGNOSTIC_LOG_KEY] = created;
  return created;
}

function nextSequence(): number {
  const target = globalThis as Record<string, unknown>;
  const current = target[DIAGNOSTIC_LOG_SEQUENCE_KEY];
  const next = typeof current === "number" ? current + 1 : 1;
  target[DIAGNOSTIC_LOG_SEQUENCE_KEY] = next;
  return next;
}

function currentContext(): Record<string, unknown> {
  if (contextStack.length === 0) {
    return {};
  }
  return Object.assign({}, ...contextStack);
}

function installGlobalHelpers(): void {
  if (helpersInstalled) {
    return;
  }
  helpersInstalled = true;
  const target = globalThis as Record<string, unknown>;
  target.__smalldrawGetDiagnosticLog = (): DiagnosticLogEntry[] =>
    getDiagnosticLogEntries();
}

export function withDiagnosticContext<T>(
  context: Record<string, unknown>,
  task: () => T,
): T {
  contextStack.push(context);
  try {
    return task();
  } finally {
    contextStack.pop();
  }
}

export function logDiagnosticEvent(
  event: string,
  metadata?: Record<string, unknown>,
  level: DiagnosticLogLevel = "info",
): void {
  installGlobalHelpers();
  const context = currentContext();
  const mergedMetadata = {
    ...context,
    ...(metadata ?? {}),
  };
  const entry: DiagnosticLogEntry = {
    sequence: nextSequence(),
    timestamp: new Date().toISOString(),
    event,
    level,
    metadata:
      Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
  };
  const buffer = getLogBuffer();
  buffer.push(entry);
  if (buffer.length > DIAGNOSTIC_LOG_CAPACITY) {
    buffer.splice(0, buffer.length - DIAGNOSTIC_LOG_CAPACITY);
  }

  if (!isProductionBuild()) {
    console.debug("[smalldraw:diag]", entry.event, entry.metadata ?? {});
    return;
  }
  if (level === "warn") {
    console.warn("[smalldraw:diag]", entry.event, entry.metadata ?? {});
    return;
  }
  if (level === "error") {
    console.error("[smalldraw:diag]", entry.event, entry.metadata ?? {});
  }
}

export function getDiagnosticLogEntries(): DiagnosticLogEntry[] {
  return [...getLogBuffer()];
}
