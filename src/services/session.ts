import 'server-only';
import { redirect } from 'next/navigation';
import { loadState } from '@/data/stateRepository';
import { createSupabaseServerClient } from '@/data/supabase/server';
import type { AppState } from '@/domain/types';

/** Usuário logado e seus dados, para montar as telas. Sem sessão, vai para o login. */
export async function loadUserSession(): Promise<{ email: string; state: AppState }> {
    const db = await createSupabaseServerClient();
    const { data } = await db.auth.getClaims();
    if (!data?.claims) redirect('/login');
    return { email: (data.claims.email as string | undefined) ?? '', state: await loadState(db) };
}

/** Cliente do banco do usuário logado. Falha se a sessão expirou. */
export async function requireUserDb() {
    const db = await createSupabaseServerClient();
    const { data } = await db.auth.getClaims();
    if (!data?.claims) throw new Error('Sessão expirada. Entre novamente.');
    return { db, email: (data.claims.email as string | undefined) ?? '' };
}
