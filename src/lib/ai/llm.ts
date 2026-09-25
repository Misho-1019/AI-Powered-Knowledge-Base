import { LLM } from '@/lib/config'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmUnavailableError'
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
  const apiKey = process.env.LLM_API_KEY ?? process.env.HF_API_KEY
  if (!apiKey) {
    throw new LlmUnavailableError('Missing LLM_API_KEY (or HF_API_KEY)')
  }

  const baseUrl = (process.env.LLM_BASE_URL ?? LLM.baseUrl).replace(/\/+$/, '')
  const model = params.model ?? process.env.LLM_MODEL ?? LLM.model

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
