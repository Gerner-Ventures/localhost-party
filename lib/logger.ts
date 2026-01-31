// Structured logging module (TypeScript version of websocket-server's embedded logger)
// Configurable via LOG_LEVEL environment variable

type LogLevel = "debug" | "info" | "warn" | "error" | "none";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const CURRENT_LOG_LEVEL: number =
  LOG_LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel] ??
  LOG_LEVELS.info;

function log(
  level: string,
  category: string,
  message: string,
  data?: unknown
): void {
  const levelValue =
    LOG_LEVELS[level.toLowerCase() as LogLevel] ?? LOG_LEVELS.info;
  if (levelValue < CURRENT_LOG_LEVEL) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}] [${category}]`;
  const logFn =
    level === "ERROR"
      ? console.error
      : level === "WARN"
        ? console.warn
        : console.log;
  if (data) {
    logFn(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    logFn(`${prefix} ${message}`);
  }
}

export function logDebug(
  category: string,
  message: string,
  data?: unknown
): void {
  log("DEBUG", category, message, data);
}

export function logInfo(
  category: string,
  message: string,
  data?: unknown
): void {
  log("INFO", category, message, data);
}

export function logWarn(
  category: string,
  message: string,
  data?: unknown
): void {
  log("WARN", category, message, data);
}

export function logError(
  category: string,
  message: string,
  data?: unknown
): void {
  log("ERROR", category, message, data);
}
