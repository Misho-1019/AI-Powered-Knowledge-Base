type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatComplete(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
}) {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) throw new Error('Missing HF_API_KEY in environment variables.');

    const model = params.model ?? process.env.LLM_MODEL ?? "meta-llama/Llama-3.1-8B-Instruct";

    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: params.messages,
            temperature: params.temperature ?? 0.1,
            max_tokens: params.max_tokens ?? 400,
        })
    })

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HF chat error (${res.status}): ${msg}`)
    }

    const data = await res.json();

    const text = data?.choices?.[0]?.message?.content;

    if (!text || typeof text !== 'string') {
        throw new Error(`Unexpected HF chat response format.`)
    }

    return { text, raw: data, model }
}