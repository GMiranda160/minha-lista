'use server';

/* Login e saída (Supabase Auth com usuário ou e-mail e senha).
   O cadastro pelo app está desativado: contas são criadas no painel do Supabase. */

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/data/supabase/server';

export interface AuthFormState {
    error?: string;
}

/**
 * O Supabase identifica contas por e-mail. Um nome de usuário (sem @) vira
 * "usuario@" + este domínio, reservado pela IANA e que nunca recebe e-mail.
 */
const USERNAME_DOMAIN = 'minhalista.example.com';

function toEmail(login: string): string {
    const value = login.trim().toLowerCase();
    return value.includes('@') ? value : `${value}@${USERNAME_DOMAIN}`;
}

const AUTH_ERRORS: Record<string, string> = {
    invalid_credentials: 'Usuário ou senha incorretos.',
    email_not_confirmed: 'Conta ainda não confirmada.',
    over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
};

const translate = (error: { code?: string; message: string }) =>
    (error.code && AUTH_ERRORS[error.code]) || error.message;

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const login = String(formData.get('login') ?? '');
    const password = String(formData.get('password') ?? '');
    if (!login.trim() || !password) return { error: 'Informe usuário e senha.' };

    const db = await createSupabaseServerClient();
    const { error } = await db.auth.signInWithPassword({ email: toEmail(login), password });
    if (error) return { error: translate(error) };
    redirect('/lista');
}

export async function signOut(): Promise<void> {
    const db = await createSupabaseServerClient();
    await db.auth.signOut();
    redirect('/login');
}
