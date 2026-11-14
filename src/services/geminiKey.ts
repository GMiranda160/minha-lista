import 'server-only';
import { createDecipheriv, scryptSync } from 'node:crypto';

/* =================================================================
   Chave do Gemini cifrada (AES-256-GCM). O texto cifrado pode ficar no
   código; a senha que o decifra fica só em GEMINI_KEY_SECRET (.env.local
   e variáveis da Vercel). Para trocar a chave: scripts/encrypt-key.mjs.
   ================================================================= */

const ENCRYPTED_GEMINI_KEY =
    'Z/Lz/SVaa5+j16Fgv7nRhXmc+/omT8xnZU9IMPxv4AQU0RUfiCpSMf+a/QnooJwEf8jfUrxCxMD8RRzdeIhiUnpEt60epO3S/RVMhGh2WqR5hBRtnwRpr/5nE64QDGfW5w==';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function geminiApiKey(): string {
    /* Painéis de variáveis costumam deixar espaço, quebra de linha ou aspas ao colar. */
    const secret = process.env.GEMINI_KEY_SECRET?.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
    if (!secret) throw new Error('Configure GEMINI_KEY_SECRET no .env.local');

    const raw = Buffer.from(ENCRYPTED_GEMINI_KEY, 'base64');
    const salt = raw.subarray(0, SALT_BYTES);
    const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const tag = raw.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + TAG_BYTES);
    const body = raw.subarray(SALT_BYTES + IV_BYTES + TAG_BYTES);

    try {
        const decipher = createDecipheriv('aes-256-gcm', scryptSync(secret, salt, 32), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    } catch {
        console.error(`GEMINI_KEY_SECRET recebida com ${secret.length} caracteres não decifra a chave.`);
        throw new Error('GEMINI_KEY_SECRET não decifra a chave do Gemini.');
    }
}
