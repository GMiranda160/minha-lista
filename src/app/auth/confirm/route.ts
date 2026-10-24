import { NextResponse, type NextRequest } from 'next/server';
import { confirmEmail } from '@/services/emailConfirmation';

/** Destino do link de confirmação de e-mail enviado pelo Supabase. */
export async function GET(request: NextRequest) {
    const confirmed = await confirmEmail(request.nextUrl.searchParams);
    const target = request.nextUrl.clone();
    target.search = '';
    target.pathname = confirmed ? '/lista' : '/login';
    if (!confirmed) target.searchParams.set('erro', 'confirmacao');
    return NextResponse.redirect(target);
}
