'use server';

/* Login, cadastro e saída (Supabase Auth com e-mail e senha). */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/data/supabase/server';

export interface AuthFormState {
    error?: string;
    message?: string;
}

function readCredentials(formData: FormData) {
    return {
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
    };
}

const AUTH_ERRORS: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).',
    user_already_exists: 'Este e-mail já está cadastrado.',
    weak_password: 'Senha fraca: use pelo menos 6 caracteres.',
    over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
};

const translate = (error: { code?: string; message: string }) =>
    (error.code && AUTH_ERRORS[error.code]) || error.message;

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const { email, password } = readCredentials(formData);
    if (!email || !password) return { error: 'Informe e-mail e senha.' };

    const db = await createSupabaseServerClient();
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) return { error: translate(error) };
    redirect('/lista');
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const { email, password } = readCredentials(formData);
    if (!email || password.length < 6) return { error: 'Informe o e-mail e uma senha com pelo menos 6 caracteres.' };

    const origin = (await headers()).get('origin') ?? '';
    const db = await createSupabaseServerClient();
    const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/confirm` },
    });
    if (error) return { error: translate(error) };
    if (data.session) redirect('/lista');
    return { message: 'Cadastro feito! Abra o link enviado para o seu e-mail para confirmar a conta.' };
}

export async function signOut(): Promise<void> {
    const db = await createSupabaseServerClient();
    await db.auth.signOut();
    redirect('/login');
}
