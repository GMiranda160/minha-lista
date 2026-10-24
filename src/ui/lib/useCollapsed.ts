'use client';

import { useCallback, useSyncExternalStore } from 'react';

/* Conjunto de ids recolhidos, guardado no navegador (preferência de cada aparelho). */

const listeners = new Set<() => void>();
const EMPTY = '[]';

/** Cópia em memória: vale mesmo quando o navegador bloqueia o armazenamento. */
const cache = new Map<string, string>();

function read(key: string): string {
    if (!cache.has(key)) {
        let stored = EMPTY;
        try {
            stored = localStorage.getItem(key) ?? EMPTY;
        } catch {
            /* armazenamento bloqueado: começa tudo aberto */
        }
        cache.set(key, stored);
    }
    return cache.get(key)!;
}

function parseIds(raw: string): Set<number> {
    try {
        const ids: unknown = JSON.parse(raw);
        return new Set(Array.isArray(ids) ? ids.filter(Number.isInteger) : []);
    } catch {
        return new Set();
    }
}

function write(key: string, ids: number[]) {
    const value = JSON.stringify(ids);
    cache.set(key, value);
    try {
        localStorage.setItem(key, value);
    } catch {
        /* navegador sem armazenamento: a preferência vale só nesta visita */
    }
    listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function useCollapsed(storageKey: string) {
    const raw = useSyncExternalStore(subscribe, () => read(storageKey), () => EMPTY);
    const collapsed = parseIds(raw);

    const toggle = useCallback((id: number) => {
        const next = parseIds(read(storageKey));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        write(storageKey, [...next]);
    }, [storageKey]);

    return { isCollapsed: (id: number) => collapsed.has(id), toggle };
}
