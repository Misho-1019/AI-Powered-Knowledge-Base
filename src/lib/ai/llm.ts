import { LLM } from '@/lib/config'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmUnavailableError'
  }
}

function resolveConfig(params: { model?: string }) {
  const apiKey = process.env.LLM_API_KEY ?? process.env.HF_API_KEY
  if (!apiKey) {
    throw new LlmUnavailableError('Missing LLM_API_KEY (or HF_API_KEY)')
  }

  return {
    apiKey,
    baseUrl: (process.env.LLM_BASE_URL ?? LLM.baseUrl).replace(/\/+$/, ''),
    model: params.model ?? process.env.LLM_MODEL ?? LLM.model,
  }
}

/**
 * OpenAI-compatible chat completion.
 *
 * Provider-agnostic on purpose: only the base URL, model and key come from the
 * environment, so swapping provider is configuration rather than a code change.
 * HuggingFace's router speaks this exact shape, which is why the default works
 * unchanged.
 */
export async function chatComplete(params: {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<{ text: string; model: string }> {
  const { apiKey, baseUrl, model } = resolveConfig(params)

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? LLM.temperature,
        max_tokens: params.maxTokens ?? LLM.maxTokens,
      }),
      signal: AbortSignal.timeout(LLM.timeoutMs),
    })
  } catch (err) {
    throw new LlmUnavailableError(
      `LLM request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new LlmUnavailableError(
      `LLM error (${res.status}): ${detail.slice(0, 200)}`,
    )
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content

  if (typeof text !== 'string' || text.length === 0) {
    throw new LlmUnavailableError('Unexpected LLM response format')
  }

  return { text, model }
}

/**
 * Streaming variant: yields content deltas as they arrive.
 *
 * The endpoint returns `text/event-stream`, so we parse Server-Sent Events and
 * re-emit only the text. Anything unparseable (keepalives, partial lines) is
 * skipped rather than fatal.
 */
export async function* chatCompleteStream(params: {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}): AsyncGenerator<string> {
  const { apiKey, baseUrl, model } = resolveConfig(params)

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? LLM.temperature,
        max_tokens: params.maxTokens ?? LLM.maxTokens,
        stream: true,
      }),
      signal: AbortSignal.timeout(LLM.timeoutMs),
    })
  } catch (err) {
    throw new LlmUnavailableError(
      `LLM stream request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new LlmUnavailableError(
      `LLM stream error (${res.status}): ${detail.slice(0, 200)}`,
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawContent = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // Keep the trailing partial line for the next read.
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          if (!sawContent) {
            throw new LlmUnavailableError('LLM stream returned no content')
          }
          return
        }

        try {
          const json = JSON.parse(payload)
          const delta = json?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            sawContent = true
            yield delta
          }
        } catch {
          // Keepalive or a partial frame — ignore.
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // already released
    }
  }

  if (!sawContent) {
    throw new LlmUnavailableError('LLM stream returned no content')
  }
}
