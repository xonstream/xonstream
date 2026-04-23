const getTimestamp = () => {
  return new Date().toISOString();
};

const logger = {
  info: (message, meta = {}) => {
    console.log(`[${getTimestamp()}] [INFO] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },

  error: (message, error = null) => {
    const errorDetails = error ? ` | Error: ${error.message}` : '';
    const stack = error?.stack ? `\n${error.stack}` : '';
    console.error(`[${getTimestamp()}] [ERROR] ${message}${errorDetails}${stack}`);
  },

  warn: (message, meta = {}) => {
    console.warn(`[${getTimestamp()}] [WARN] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${getTimestamp()}] [DEBUG] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  }
};

module.exports = logger;
