/**
 * Console Error Filter
 * Suppresses browser's automatic console logging for failed fetch requests
 * This prevents backend URLs from appearing in the console
 */

// Store original console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Patterns to filter out (URLs and fetch errors)
const PATTERNS_TO_SUPPRESS = [
  'GET http',
  'POST http',
  'PUT http',
  'DELETE http',
  'PATCH http',
  'Failed to fetch',
  'net::ERR_',
];

// Override console.error to filter out fetch-related errors
console.error = function (...args: any[]) {
  const message = args.join(' ');
  
  // Check if this is a fetch error we want to suppress
  const shouldSuppress = PATTERNS_TO_SUPPRESS.some(pattern => 
    message.includes(pattern)
  );
  
  if (!shouldSuppress) {
    // Only log if it's not a fetch error
    originalConsoleError.apply(console, args);
  }
};

// Override console.warn to filter out ad-related warnings
console.warn = function (...args: any[]) {
  const message = args.join(' ');
  
  // Suppress ad network and permissions policy warnings
  const shouldSuppress = 
    message.includes('Permissions-Policy') ||
    message.includes('net::ERR_BLOCKED_BY_CLIENT') ||
    message.includes('profitablecpmratenetwork');
  
  if (!shouldSuppress) {
    originalConsoleWarn.apply(console, args);
  }
};

// Export function to restore original console (for debugging)
export function restoreConsole() {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
}
