/* =================================================================
   Formatos de arquivo: backup completo e exportação de um ciclo.
   Aceita os formatos do app desktop antigo (lista.json v3, v4 e v5).
   ================================================================= */

import { isCategory } from './constants';
import { normalizeHistory, normalizePattern } from './state';
import { isIsoDate, toIsoDate } from './text';
import type { AppState, Category, Cycle, Purchase, PurchasePattern } from './types';

export const BACKUP_SCHEMA_VERSION = 6;

/** Produto como guardado no backup (sem id: o banco gera um novo). */
export interface BackupProduct {
    name: string;
    imageUrl: string;
    category: Category;
    visible: boolean;
    history: Purchase[];
    pattern: PurchasePattern;
}

export interface Backup {
    app: 'minha-lista';
    schemaVersion: number;
    exportDate: string;
    totalCycles: number;
    lastDecayCheck: number;
    products: BackupProduct[];
}

export function createBackup(state: AppState, now = new Date()): Backup {
    return {
        app: 'minha-lista',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportDate: toIsoDate(now),
        totalCycles: state.totalCycles,
        lastDecayCheck: state.lastDecayCheck,
        products: state.products.map(({ name, imageUrl, category, visible, history, pattern }) =>
            ({ name, imageUrl, category, visible, history, pattern })),
    };
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;

const toNumber = (value: unknown, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function readProduct(raw: unknown, fallbackDate: string, keepHistory: boolean): BackupProduct | null {
    if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name.trim()) return null;

    let history: Purchase[] = [];
    if (keepHistory && Array.isArray(raw.history)) {
        history = raw.history.filter(isObject).map(h => ({
            cycle: toNumber(h.cycle),
            date: isIsoDate(h.date) ? h.date : fallbackDate,
            quantity: Math.max(1, toNumber(h.quantity, 1)),
        }));
    } else if (keepHistory && isObject(raw.annualHistory)) {
        /* app desktop: { "2025": [{ date, quantity, listId, listIndex }] } */
        history = Object.values(raw.annualHistory).flatMap(entries =>
            (Array.isArray(entries) ? entries : []).filter(isObject).map(e => ({
                cycle: toNumber(e.listId ?? e.listIndex),
                date: isIsoDate(e.date) ? e.date : fallbackDate,
                quantity: Math.max(1, toNumber(e.quantity, 1)),
            })));
    }

    const rawPattern = keepHistory ? (raw.pattern ?? raw.purchasePattern) : null;
    return {
        name: raw.name.trim(),
        imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
        category: isCategory(raw.category) ? raw.category : 'outros',
        visible: raw.visible !== false,
        history: normalizeHistory(history),
        pattern: normalizePattern(isObject(rawPattern) ? rawPattern as Partial<PurchasePattern> : null),
    };
}

/**
 * Lê qualquer formato suportado. Formatos antigos sem contador de ciclos
 * (v3 e lista simples) entram sem histórico, como no app desktop.
 */
export function parseBackup(raw: unknown, now = new Date()): Omit<Backup, 'app' | 'schemaVersion' | 'exportDate'> | null {
    const fallbackDate = toIsoDate(now);
    const build = (products: unknown[], keepHistory: boolean, totalCycles: unknown, lastDecay: unknown) => ({
        products: products
            .map(p => readProduct(p, fallbackDate, keepHistory))
            .filter((p): p is BackupProduct => p !== null),
        totalCycles: keepHistory ? toNumber(totalCycles) : 0,
        lastDecayCheck: keepHistory ? toNumber(lastDecay) : 0,
    });

    if (Array.isArray(raw)) return build(raw, false, 0, 0);
    if (!isObject(raw) || !Array.isArray(raw.products)) return null;

    if (raw.app === 'minha-lista') return build(raw.products, true, raw.totalCycles, raw.lastDecayCheck);
    if (raw.schemaVersion || raw.version === 4 || raw.version === 5) {
        return build(raw.products, true, raw.totalListsGlobal, raw.lastDecayCheckIndex);
    }
    if (raw.version === 3) return build(raw.products, false, 0, 0);
    return null;
}

/* -------------------------------------------------------------
   EXPORTAÇÃO DE UM CICLO (compatível com o app desktop)
   ------------------------------------------------------------- */

export interface CycleFileItem {
    productName: string;
    category: Category;
    quantity: number;
}

export interface CycleFile {
    date: string;
    items: CycleFileItem[];
}

export function createCycleExport(cycle: Cycle, now = new Date()) {
    return {
        type: 'shopping-cycle-export',
        version: 1,
        exportDate: toIsoDate(now),
        cycle: {
            date: cycle.date,
            items: cycle.items.map(({ productName, category, quantity }) => ({ productName, category, quantity })),
        },
    };
}

export function parseCycleExport(raw: unknown, now = new Date()): CycleFile | null {
    if (!isObject(raw) || raw.type !== 'shopping-cycle-export' || !isObject(raw.cycle)) return null;
    const { date, items } = raw.cycle;
    if (!Array.isArray(items)) return null;

    const parsed = items
        .filter(isObject)
        .filter(i => typeof i.productName === 'string' && i.productName.trim())
        .map(i => ({
            productName: String(i.productName).trim(),
            category: isCategory(i.category) ? i.category : 'outros' as Category,
            quantity: Math.max(1, Math.floor(Number(i.quantity)) || 1),
        }));
    return parsed.length > 0 ? { date: isIsoDate(date) ? date : toIsoDate(now), items: parsed } : null;
}
