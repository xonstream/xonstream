/**
 * Production-safe logger
 * Only shows errors in production, all logs in development
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  // Only logs in development
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Only logs in development
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Only logs in development
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  // Warn only in development (can be enabled in production if needed)
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  // Always log errors (important for debugging in production)
  error: (...args: any[]) => {
    console.error(...args);
  },
};
