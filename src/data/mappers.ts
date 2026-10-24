/* Conversão entre linhas do banco (snake_case) e objetos do domínio. */

import { normalizeProduct } from '@/domain/state';
import type { AppState, Product, PurchasePattern, SortDirection, SortMode } from '@/domain/types';
import type { Backup } from '@/domain/backup';
import type { Changeset, ProductFields } from '@/domain/changes';

export interface ProductRow {
    id: number;
    name: string;
    image_url: string;
    category: string;
    visible: boolean;
    selected: boolean;
    quantity: number;
    pattern: Partial<PurchasePattern>;
}

export interface PurchaseRow {
    product_id: number;
    cycle: number;
    date: string;
    quantity: number;
}

export interface SettingsRow {
    total_cycles: number;
    last_decay_check: number;
    sort_mode: SortMode;
    sort_direction: SortDirection;
}

export function toProductRow(p: ProductFields): ProductRow {
    return {
        id: p.id,
        name: p.name,
        image_url: p.imageUrl,
        category: p.category,
        visible: p.visible,
        selected: p.selected,
        quantity: p.quantity,
        pattern: p.pattern,
    };
}

export function toAppState(products: ProductRow[], purchases: PurchaseRow[], settings: SettingsRow | null): AppState {
    const historyByProduct = new Map<number, PurchaseRow[]>();
    purchases.forEach(row => {
        const list = historyByProduct.get(row.product_id) ?? [];
        list.push(row);
        historyByProduct.set(row.product_id, list);
    });

    return {
        products: products.map(row => fromProductRow(row, historyByProduct.get(row.id) ?? [])),
        totalCycles: settings?.total_cycles ?? 0,
        lastDecayCheck: settings?.last_decay_check ?? 0,
        sortMode: settings?.sort_mode ?? 'alpha',
        sortDirection: settings?.sort_direction ?? 'asc',
    };
}

export function fromProductRow(row: ProductRow, purchases: PurchaseRow[] = []): Product {
    return normalizeProduct({
        id: row.id,
        name: row.name,
        imageUrl: row.image_url,
        category: row.category as Product['category'],
        visible: row.visible,
        selected: row.selected,
        quantity: row.quantity,
        pattern: row.pattern,
        history: purchases.map(p => ({ cycle: p.cycle, date: p.date, quantity: p.quantity })),
    });
}

/** Formato JSON esperado pela função apply_changes do banco. */
export function toChangesPayload(changes: Changeset) {
    const payload: Record<string, unknown> = {};
    if (changes.deletedProductIds.length) payload.deleted_products = changes.deletedProductIds;
    if (changes.products.length) payload.products = changes.products.map(toProductRow);
    if (changes.deletedPurchases.length) {
        payload.purchases_deleted = changes.deletedPurchases.map(p => ({ product_id: p.productId, cycle: p.cycle }));
    }
    if (changes.upsertedPurchases.length) {
        payload.purchases_upserted = changes.upsertedPurchases.map(p =>
            ({ product_id: p.productId, cycle: p.cycle, date: p.date, quantity: p.quantity }));
    }
    if (changes.settings) {
        const s = changes.settings;
        payload.settings = {
            total_cycles: s.totalCycles,
            last_decay_check: s.lastDecayCheck,
            sort_mode: s.sortMode,
            sort_direction: s.sortDirection,
        };
    }
    return payload;
}

/** Formato JSON esperado pela função import_backup do banco. */
export function toBackupPayload(backup: Pick<Backup, 'products'>) {
    return backup.products.map(p => ({
        name: p.name,
        image_url: p.imageUrl,
        category: p.category,
        visible: p.visible,
        pattern: p.pattern,
        history: p.history,
    }));
}
