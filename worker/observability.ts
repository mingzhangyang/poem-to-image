type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

function serialize(event: string, fields: LogFields): string {
  return JSON.stringify({ event, ...fields });
}

export function logInfo(event: string, fields: LogFields = {}): void {
  console.log(serialize(event, fields));
}

export function logError(event: string, error: unknown, fields: LogFields = {}): void {
  console.error(serialize(event, {
    ...fields,
    errorType: error instanceof Error ? error.name : typeof error,
  }));
}

export function requestIdFor(request: Request): string {
  return request.headers.get('cf-ray') ?? crypto.randomUUID();
}

export function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-ID', requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
