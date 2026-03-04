export async function embedText(text: string): Promise<number[]> {
    const apiKey = process.env.HF_API_KEY;

    if (!apiKey) throw new Error('Missing HF_API_KEY in environment variables.');

    const model = 'sentence-transformers/all-mpnet-base-v2';

    const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text })
    })

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HF embeddings error (${res.status}): ${msg}`)
    }

    const data = await res.json();

    if (Array.isArray(data) && typeof data[0] === 'number') {
        return data as number[]
    }

    if (Array.isArray(data) && Array.isArray(data[0])) {
        const tokenEmbeddings = data as number[][];

        const dim = tokenEmbeddings[0]?.length ?? 0;

        const pooled = new Array(dim).fill(0);

        for (const vec of tokenEmbeddings) {
            for (let i = 0; i < dim; i++) pooled[i] += vec[i];
        }

        for (let i = 0; i < dim; i++) pooled[i] /= tokenEmbeddings.length

        return pooled
    }

    throw new Error('Unexpected HF embeddings response format.')
}