import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './env';

const PUBLIC_PATHS = ['/login', '/auth'];

/**
 * Renova a sessão a cada requisição (cookies) e protege as rotas:
 * sem login vai para /login; logado em /login volta para /lista.
 */
export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });
    const { url, key } = supabaseEnv();

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet, headers) => {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                Object.entries(headers ?? {}).forEach(([header, value]) => response.headers.set(header, value));
            },
        },
    });

    const { data } = await supabase.auth.getClaims();
    const isLoggedIn = !!data?.claims;
    const path = request.nextUrl.pathname;
    const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(`${p}/`));

    if (!isLoggedIn && !isPublic) return redirectKeepingCookies(request, '/login', response);
    if (isLoggedIn && path === '/login') return redirectKeepingCookies(request, '/lista', response);
    return response;
}

function redirectKeepingCookies(request: NextRequest, pathname: string, from: NextResponse) {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = '';
    const redirect = NextResponse.redirect(target);
    from.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
}
