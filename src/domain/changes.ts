/* =================================================================
   Diferença entre dois estados do domínio. A tela calcula o próximo
   estado, este módulo descobre o que mudou e só isso vai ao banco.
   ================================================================= */

import type { AppState, Product, Purchase, SortDirection, SortMode } from './types';

export type ProductFields = Omit<Product, 'history'>;

export interface PurchaseRef {
    productId: number;
    cycle: number;
}

export interface Changeset {
    deletedProductIds: number[];
    products: ProductFields[];
    deletedPurchases: PurchaseRef[];
    upsertedPurchases: (PurchaseRef & Omit<Purchase, 'cycle'>)[];
    settings: {
        totalCycles: number;
        lastDecayCheck: number;
        sortMode: SortMode;
        sortDirection: SortDirection;
    } | null;
}

const fieldsOf = ({ history, ...fields }: Product): ProductFields => fields;

const settingsOf = (s: AppState): NonNullable<Changeset['settings']> =>
    ({ totalCycles: s.totalCycles, lastDecayCheck: s.lastDecayCheck, sortMode: s.sortMode, sortDirection: s.sortDirection });

const purchaseKey = (productId: number, cycle: number) => `${productId}:${cycle}`;

function purchaseMap(state: AppState) {
    const map = new Map<string, PurchaseRef & Purchase>();
    state.products.forEach(p => p.history.forEach(h => map.set(purchaseKey(p.id, h.cycle), { productId: p.id, ...h })));
    return map;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Retorna null quando nada precisa ser gravado. */
export function diffState(before: AppState, after: AppState): Changeset | null {
    const beforeById = new Map(before.products.map(p => [p.id, p]));
    const afterIds = new Set(after.products.map(p => p.id));

    const deletedProductIds = before.products.filter(p => !afterIds.has(p.id)).map(p => p.id);
    const products = after.products
        .filter(p => {
            const previous = beforeById.get(p.id);
            return previous && !same(fieldsOf(previous), fieldsOf(p));
        })
        .map(fieldsOf);

    const oldPurchases = purchaseMap(before);
    const newPurchases = purchaseMap(after);
    const deletedPurchases = [...oldPurchases.entries()]
        .filter(([key, p]) => !newPurchases.has(key) && afterIds.has(p.productId))
        .map(([, { productId, cycle }]) => ({ productId, cycle }));
    const upsertedPurchases = [...newPurchases.entries()]
        .filter(([key, p]) => !same(oldPurchases.get(key), p))
        .map(([, p]) => p);

    const settings = same(settingsOf(before), settingsOf(after)) ? null : settingsOf(after);

    const empty = !deletedProductIds.length && !products.length && !deletedPurchases.length &&
        !upsertedPurchases.length && !settings;
    return empty ? null : { deletedProductIds, products, deletedPurchases, upsertedPurchases, settings };
}
