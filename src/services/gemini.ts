import 'server-only';
import { geminiApiKey } from './geminiKey';

/* Cliente mínimo da API do Gemini. Só roda no servidor: a chave nunca chega ao navegador. */

/* Tenta o primeiro modelo e, se ele falhar, o seguinte. */
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const TIMEOUT_MS = 30_000;
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function post(url: string, apiKey: string, body: unknown): Promise<Response> {
    try {
        return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: 'no-store',
        });
    } catch {
        throw new Error('Não foi possível falar com o Gemini. Tente novamente.');
    }
}

async function generateWithModel(model: string, apiKey: string, body: unknown): Promise<string> {
    const response = await post(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, apiKey, body);
    if (!response.ok) {
        console.error(`Gemini (${model}) respondeu`, response.status, await response.text());
        throw new Error(response.status === 429
            ? 'Limite de uso do Gemini atingido. Tente em instantes.'
            : 'O Gemini não conseguiu responder. Tente novamente.');
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('');
    if (!text) throw new Error('O Gemini devolveu uma resposta vazia.');
    return text;
}

/** Pede uma resposta em JSON que siga o schema e devolve o texto bruto. */
export async function generateJson(instructions: string, prompt: string, schema: object): Promise<string> {
    const apiKey = geminiApiKey();
    const body = {
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
    };

    let lastError: unknown;
    for (const model of MODELS) {
        try {
            return await generateWithModel(model, apiKey, body);
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}
