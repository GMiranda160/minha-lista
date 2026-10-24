import 'server-only';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/data/supabase/server';

/** Valida o link de confirmação de e-mail (fluxo PKCE ou token_hash). */
export async function confirmEmail(params: URLSearchParams): Promise<boolean> {
    const code = params.get('code');
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    const db = await createSupabaseServerClient();

    if (code) return !(await db.auth.exchangeCodeForSession(code)).error;
    if (tokenHash && type) return !(await db.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    return false;
}
