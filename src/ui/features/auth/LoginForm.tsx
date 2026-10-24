'use client';

import { LogIn, ShoppingBasket, UserPlus } from 'lucide-react';
import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthFormState } from '@/services/authActions';

type Mode = 'entrar' | 'cadastrar';

export function LoginForm({ confirmationFailed }: { confirmationFailed: boolean }) {
    const [mode, setMode] = useState<Mode>('entrar');

    return (
        <main className="welcome">
            <div className="welcome-card">
                <div className="brand">
                    <h1>Minha Lista</h1>
                    <p>Sua compra inteligente</p>
                </div>
                <span className="welcome-icon"><ShoppingBasket size={40} /></span>
                <p className="welcome-desc">
                    Monte sua lista de compras, cadastre seu catálogo de produtos e acompanhe seus
                    padrões de compra por ciclos, no celular ou no computador.
                </p>

                <AuthForm key={mode} mode={mode} confirmationFailed={confirmationFailed} />

                <button type="button" className="link-btn" onClick={() => setMode(mode === 'entrar' ? 'cadastrar' : 'entrar')}>
                    {mode === 'cadastrar' ? 'Já tenho conta: entrar' : 'Não tem conta? Cadastre-se'}
                </button>
            </div>
        </main>
    );
}

function AuthForm({ mode, confirmationFailed }: { mode: Mode; confirmationFailed: boolean }) {
    const isSignUp = mode === 'cadastrar';
    const [state, formAction, pending] = useActionState<AuthFormState, FormData>(isSignUp ? signUp : signIn, {});

    return (
        <form action={formAction} className="form">
            <label className="form-field">
                <span>E-mail</span>
                <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="form-field">
                <span>Senha</span>
                <input
                    name="password"
                    type="password"
                    minLength={6}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                />
            </label>

            {confirmationFailed && !state.error && !state.message && (
                <p className="form-error">Link de confirmação inválido ou expirado. Tente entrar ou cadastre-se de novo.</p>
            )}
            {state.error && <p className="form-error">{state.error}</p>}
            {state.message && <p className="form-success">{state.message}</p>}

            <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
                {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
                {pending ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
            </button>
        </form>
    );
}
