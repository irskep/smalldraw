export type StartupLogLevel = "info" | "warn" | "error";

export interface StartupLogEntry {
  timestamp: string;
  event: string;
  level: StartupLogLevel;
  metadata?: Record<string, unknown>;
}

const STARTUP_LOG_KEY = "__smalldrawStartupLog";
const STARTUP_LOG_CAPACITY = 250;

function isProductionBuild(): boolean {
  if (typeof process === "undefined") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function getRingBuffer(): StartupLogEntry[] {
  const target = globalThis as Record<string, unknown>;
  const existing = target[STARTUP_LOG_KEY];
  if (Array.isArray(existing)) {
    return existing as StartupLogEntry[];
  }
  const created: StartupLogEntry[] = [];
  target[STARTUP_LOG_KEY] = created;
  return created;
}

export function logStartupEvent(
  event: string,
  metadata?: Record<string, unknown>,
  level: StartupLogLevel = "info",
): void {
  const entry: StartupLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    level,
    metadata,
  };
  const ringBuffer = getRingBuffer();
  ringBuffer.push(entry);
  if (ringBuffer.length > STARTUP_LOG_CAPACITY) {
    ringBuffer.splice(0, ringBuffer.length - STARTUP_LOG_CAPACITY);
  }

  const payload = metadata ?? {};
  if (!isProductionBuild()) {
    console.debug("[smalldraw:startup]", event, payload);
    return;
  }
  if (level === "warn") {
    console.warn("[smalldraw:startup]", event, payload);
    return;
  }
  if (level === "error") {
    console.error("[smalldraw:startup]", event, payload);
  }
}

export function getStartupLogEntries(): StartupLogEntry[] {
  return [...getRingBuffer()];
}
