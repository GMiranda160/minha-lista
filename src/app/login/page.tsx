import { LoginForm } from '@/ui/features/auth/LoginForm';

export const metadata = { title: 'Entrar | Minha Lista' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
    const { erro } = await searchParams;
    return <LoginForm confirmationFailed={erro === 'confirmacao'} />;
}
