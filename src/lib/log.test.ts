import { afterEach, describe, expect, it, vi } from 'vitest'
import { log, logger, requestIdFrom } from './log'

/**
 * Pins the log contract: single-line JSON, request ids, safe Errors.
 * Everything downstream (Vercel parsing, request correlation) depends on it.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

function lastJson(spy: {
  mock: { calls: unknown[][] }
}): Record<string, unknown> {
  const [line] = spy.mock.calls.at(-1) ?? []
  return JSON.parse(String(line)) as Record<string, unknown>
}

describe('logger', () => {
  it('emits single-line JSON with level, request id and message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger('req-1').error('boom', { code: 500 })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = lastJson(spy)
    expect(parsed.level).toBe('error')
    expect(parsed.requestId).toBe('req-1')
    expect(parsed.msg).toBe('boom')
    expect(parsed.code).toBe(500)
    expect(typeof parsed.ts).toBe('string')
  })

  it('routes info to console.info and defaults to the system scope', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    log.info('hello')

    const parsed = lastJson(spy)
    expect(parsed.level).toBe('info')
    expect(parsed.requestId).toBe('system')
  })

  it('serializes Errors instead of printing "[object Object]"', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger('req-2').error('failed', { error: new TypeError('bad input') })

    const parsed = lastJson(spy)
    const serialized = parsed.error as Record<string, unknown>
    expect(serialized.name).toBe('TypeError')
    expect(serialized.message).toBe('bad input')
    expect(typeof serialized.stack).toBe('string')
  })
})

describe('requestIdFrom', () => {
  it('honors an incoming x-request-id so ids follow hops', () => {
    const request = new Request('http://localhost/', {
      headers: { 'x-request-id': 'cron-123' },
    })
    expect(requestIdFrom(request)).toBe('cron-123')
  })

  it('mints a uuid when none is provided', () => {
    const first = requestIdFrom(new Request('http://localhost/'))
    const second = requestIdFrom(new Request('http://localhost/'))
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).not.toBe(first)
  })

  it('rejects absurdly long incoming ids', () => {
    const request = new Request('http://localhost/', {
      headers: { 'x-request-id': 'x'.repeat(200) },
    })
    expect(requestIdFrom(request)).not.toBe('x'.repeat(200))
  })
})
