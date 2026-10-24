'use client';

import { LogIn, ShoppingBasket } from 'lucide-react';
import { useActionState } from 'react';
import { signIn, type AuthFormState } from '@/services/authActions';

export function LoginForm({ confirmationFailed }: { confirmationFailed: boolean }) {
    const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, {});

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

                <form action={formAction} className="form">
                    <label className="form-field">
                        <span>Usuário</span>
                        <input
                            name="login"
                            type="text"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                        />
                    </label>
                    <label className="form-field">
                        <span>Senha</span>
                        <input name="password" type="password" autoComplete="current-password" required />
                    </label>

                    {confirmationFailed && !state.error && (
                        <p className="form-error">Link inválido ou expirado. Entre com seu usuário e senha.</p>
                    )}
                    {state.error && <p className="form-error">{state.error}</p>}

                    <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
                        <LogIn size={18} /> {pending ? 'Aguarde...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </main>
    );
}
