type ErrorReporter = (message: string, error?: unknown) => void;

let reporter: ErrorReporter = (message, error) => {
  console.error(`[InkPoem] ${message}`, error);
};

/** Override the reporter (e.g. to integrate Sentry in production). */
export function setErrorReporter(fn: ErrorReporter) {
  reporter = fn;
}

export function logError(message: string, error?: unknown) {
  reporter(message, error);
}
