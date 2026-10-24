import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

/** Cliente Supabase do servidor, autenticado pelos cookies da requisição. */
export async function createSupabaseServerClient() {
    const cookieStore = await cookies();
    const { url, key } = supabaseEnv();
    return createServerClient(url, key, {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: cookiesToSet => {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                } catch {
                    /* Chamado a partir de um Server Component: o proxy renova a sessão. */
                }
            },
        },
    });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
