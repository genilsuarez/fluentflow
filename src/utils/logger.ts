/**
 * Minimal logging utility.
 * Logs are active in development mode only; no-ops in production.
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

function formatPrefix(component?: string): string {
  return component ? `[${component}]` : '';
}

export function logDebug(message: string, data?: unknown, component?: string) {
  if (!isDev) return;
  try {
    if (data !== undefined) {
      console.debug(formatPrefix(component), message, data);
    } else {
      console.debug(formatPrefix(component), message);
    }
  } catch {
    // Silent fail
  }
}

function logInfo(message: string, data?: unknown, component?: string) {
  if (!isDev) return;
  try {
    if (data !== undefined) {
      console.info(formatPrefix(component), message, data);
    } else {
      console.info(formatPrefix(component), message);
    }
  } catch {
    // Silent fail
  }
}

function logWarn(message: string, data?: unknown, component?: string) {
  try {
    if (data !== undefined) {
      console.warn(formatPrefix(component), message, data);
    } else {
      console.warn(formatPrefix(component), message);
    }
  } catch {
    // Silent fail
  }
}

export function logError(message: string, data?: unknown, component?: string) {
  try {
    if (data !== undefined) {
      console.error(formatPrefix(component), message, data);
    } else {
      console.error(formatPrefix(component), message);
    }
  } catch {
    // Silent fail
  }
}

// Backward compatibility object
export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  getLogs: () => [],
  clearLogs: () => {},
};
