/**
 * Structured logging with request ids.
 *
 * Every line is single-line JSON (`ts`, `level`, `requestId`, `msg`, …fields)
 * so Vercel/LogDrain can parse and correlate it. API routes bind one id per
 * request; library code uses the shared system logger unless the caller
 * passes its own down (the RAG and suggestion paths do, so a slow Ask can be
 * traced end to end).
 *
 * Deliberately explicit rather than AsyncLocalStorage magic: the logger is
 * constructed where the request exists and passed where it matters. No
 * hidden context to lose, nothing to mock in tests.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

export type Logger = {
  debug: (msg: string, fields?: LogFields) => void
  info: (msg: string, fields?: LogFields) => void
  warn: (msg: string, fields?: LogFields) => void
  error: (msg: string, fields?: LogFields) => void
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

function emit(
  level: LogLevel,
  requestId: string,
  msg: string,
  fields: LogFields = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    requestId,
    msg,
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, serialize(value)]),
    ),
  })

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else if (level === 'debug') console.debug(line)
  else console.info(line)
}

/** Binds a request id. Omit it for code with no request in scope. */
export function logger(requestId = 'system'): Logger {
  return {
    debug: (msg, fields) => emit('debug', requestId, msg, fields),
    info: (msg, fields) => emit('info', requestId, msg, fields),
    warn: (msg, fields) => emit('warn', requestId, msg, fields),
    error: (msg, fields) => emit('error', requestId, msg, fields),
  }
}

/** Shared logger for code with no request in scope. */
export const log = logger()

/**
 * Honors an incoming `x-request-id` so one id follows a request across hops
 * (cron, proxies); otherwise mints a v4 uuid.
 */
export function requestIdFrom(request: Request): string {
  const incoming = request.headers.get('x-request-id')?.trim()
  if (incoming && incoming.length <= 128) return incoming
  return crypto.randomUUID()
}
