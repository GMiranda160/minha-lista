import type { ReactNode } from 'react';
import { loadUserSession } from '@/services/session';
import { AppShell } from '@/ui/layout/AppShell';
import { AppStoreProvider } from '@/ui/store/AppStoreProvider';

export default async function AppLayout({ children }: { children: ReactNode }) {
    const { email, state } = await loadUserSession();
    return (
        <AppStoreProvider initialState={state}>
            <AppShell email={email}>{children}</AppShell>
        </AppStoreProvider>
    );
}
