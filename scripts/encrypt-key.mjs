/* Criptografa uma chave de API (AES-256-GCM) para guardá-la no código.
   Uso: PLAIN_KEY=... GEMINI_KEY_SECRET=... node scripts/encrypt-key.mjs
   Se GEMINI_KEY_SECRET não for informado, uma senha aleatória é gerada e mostrada. */
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

const plain = process.env.PLAIN_KEY;
if (!plain) throw new Error('Informe PLAIN_KEY.');
const secret = process.env.GEMINI_KEY_SECRET || randomBytes(32).toString('base64url');

const salt = randomBytes(16);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', scryptSync(secret, salt, 32), iv);
const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
const blob = Buffer.concat([salt, iv, cipher.getAuthTag(), body]).toString('base64');

console.log(`GEMINI_KEY_SECRET=${secret}`);
console.log(`ENCRYPTED_GEMINI_KEY=${blob}`);
