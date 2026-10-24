'use client';

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AppState } from '@/domain/types';
import { AppStore } from './appStore';

const StoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ initialState, children }: { initialState: AppState; children: ReactNode }) {
    const [store] = useState(() => new AppStore(initialState));
    return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
    const store = useContext(StoreContext);
    if (!store) throw new Error('useStore precisa estar dentro de AppStoreProvider');
    return store;
}

/** Estado atual; o componente re-renderiza quando ele muda. */
export function useAppState(): AppState {
    const store = useStore();
    return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSaveStatus() {
    const store = useStore();
    const status = useSyncExternalStore(store.subscribe, store.getSaveStatus, store.getSaveStatus);
    const error = useSyncExternalStore(store.subscribe, store.getErrorMessage, store.getErrorMessage);
    return { status, error, dismiss: store.dismissError };
}
