/* =================================================================
   Formatos de arquivo: backup completo e exportação de um ciclo.
   Aceita os formatos do app desktop antigo (lista.json v3, v4 e v5)
   e os backups anteriores à gestão de categorias (v6).
   ================================================================= */

import { categoryOf, legacyCategoryName } from './categories';
import { CATEGORY_ICONS, CATEGORY_NAME_MAX, DEFAULT_CATEGORIES } from './constants';
import { normalizeHistory, normalizePattern } from './state';
import { isIsoDate, toIsoDate } from './text';
import type { AppState, CategoryInput, Cycle, Purchase, PurchasePattern } from './types';

export const BACKUP_SCHEMA_VERSION = 7;

/** Produto como guardado no backup (sem id: o banco gera um novo). */
export interface BackupProduct {
    name: string;
    imageUrl: string;
    /** Nome da categoria. */
    category: string;
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
    /** Na ordem de exibição. */
    categories: CategoryInput[];
    products: BackupProduct[];
}

export type BackupContent = Omit<Backup, 'app' | 'schemaVersion' | 'exportDate'>;

export function createBackup(state: AppState, now = new Date()): Backup {
    return {
        app: 'minha-lista',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportDate: toIsoDate(now),
        totalCycles: state.totalCycles,
        lastDecayCheck: state.lastDecayCheck,
        categories: state.categories.map(({ name, color, icon }) => ({ name, color, icon })),
        products: state.products.map(p => ({
            name: p.name,
            imageUrl: p.imageUrl,
            category: categoryOf(state, p).name,
            visible: p.visible,
            history: p.history,
            pattern: p.pattern,
        })),
    };
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;

const toNumber = (value: unknown, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const DEFAULT_CATEGORY_INPUTS: CategoryInput[] = DEFAULT_CATEGORIES.map(({ name, color, icon }) => ({ name, color, icon }));

function readCategories(raw: unknown): CategoryInput[] {
    const categories = (Array.isArray(raw) ? raw : [])
        .filter(isObject)
        .filter(c => typeof c.name === 'string' && c.name.trim())
        .map(c => ({
            name: String(c.name).trim().slice(0, CATEGORY_NAME_MAX),
            color: typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '#64748b',
            icon: (CATEGORY_ICONS as readonly unknown[]).includes(c.icon) ? String(c.icon) : 'tag',
        }));
    return categories.length > 0 ? categories : DEFAULT_CATEGORY_INPUTS;
}

/** `legacyCategories`: a categoria do produto é uma chave fixa antiga (ex.: "armarios"). */
function readProduct(raw: unknown, fallbackDate: string, keepHistory: boolean, legacyCategories: boolean): BackupProduct | null {
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

    const rawCategory = typeof raw.category === 'string' ? raw.category.trim() : '';
    const rawPattern = keepHistory ? (raw.pattern ?? raw.purchasePattern) : null;
    return {
        name: raw.name.trim(),
        imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
        category: legacyCategories ? legacyCategoryName(rawCategory) ?? 'Outros' : rawCategory,
        visible: raw.visible !== false,
        history: normalizeHistory(history),
        pattern: normalizePattern(isObject(rawPattern) ? rawPattern as Partial<PurchasePattern> : null),
    };
}

/**
 * Lê qualquer formato suportado. Formatos antigos sem contador de ciclos
 * (v3 e lista simples) entram sem histórico, como no app desktop.
 * Formatos sem lista de categorias usam as categorias padrão.
 */
export function parseBackup(raw: unknown, now = new Date()): BackupContent | null {
    const fallbackDate = toIsoDate(now);
    const build = (products: unknown[], keepHistory: boolean, totalCycles: unknown, lastDecay: unknown, categories?: unknown) => {
        const legacy = categories === undefined;
        return {
            categories: legacy ? DEFAULT_CATEGORY_INPUTS : readCategories(categories),
            products: products
                .map(p => readProduct(p, fallbackDate, keepHistory, legacy))
                .filter((p): p is BackupProduct => p !== null),
            totalCycles: keepHistory ? toNumber(totalCycles) : 0,
            lastDecayCheck: keepHistory ? toNumber(lastDecay) : 0,
        };
    };

    if (Array.isArray(raw)) return build(raw, false, 0, 0);
    if (!isObject(raw) || !Array.isArray(raw.products)) return null;

    if (raw.app === 'minha-lista') {
        return build(raw.products, true, raw.totalCycles, raw.lastDecayCheck, Array.isArray(raw.categories) ? raw.categories : undefined);
    }
    if (raw.schemaVersion || raw.version === 4 || raw.version === 5) {
        return build(raw.products, true, raw.totalListsGlobal, raw.lastDecayCheckIndex);
    }
    if (raw.version === 3) return build(raw.products, false, 0, 0);
    return null;
}

/* -------------------------------------------------------------
   EXPORTAÇÃO DE UM CICLO
   ------------------------------------------------------------- */

export interface CycleFileItem {
    productName: string;
    /** Nome da categoria (ou chave antiga do app desktop). */
    category: string;
    quantity: number;
}

export interface CycleFile {
    date: string;
    items: CycleFileItem[];
}

export function createCycleExport(state: AppState, cycle: Cycle, now = new Date()) {
    return {
        type: 'shopping-cycle-export',
        version: 2,
        exportDate: toIsoDate(now),
        cycle: {
            date: cycle.date,
            items: cycle.items.map(item => ({
                productName: item.productName,
                category: categoryOf(state, item).name,
                quantity: item.quantity,
            })),
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
            category: typeof i.category === 'string' ? i.category.trim() : '',
            quantity: Math.max(1, Math.floor(Number(i.quantity)) || 1),
        }));
    return parsed.length > 0 ? { date: isIsoDate(date) ? date : toIsoDate(now), items: parsed } : null;
}
