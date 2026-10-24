/* =================================================================
   Diferença entre dois estados do domínio. A tela calcula o próximo
   estado, este módulo descobre o que mudou e só isso vai ao banco.
   ================================================================= */

import type { AppState, Category, Product, Purchase, SortDirection, SortMode } from './types';

export type ProductFields = Omit<Product, 'history'>;

export interface PurchaseRef {
    productId: number;
    cycle: number;
}

export interface Changeset {
    deletedCategoryIds: number[];
    categories: Category[];
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

/** Registros removidos e alterados entre duas listas com id (itens novos já foram gravados). */
function diffById<T extends { id: number }, F>(before: T[], after: T[], fields: (item: T) => F) {
    const beforeById = new Map(before.map(item => [item.id, item]));
    const afterIds = new Set(after.map(item => item.id));
    return {
        deleted: before.filter(item => !afterIds.has(item.id)).map(item => item.id),
        changed: after
            .filter(item => {
                const previous = beforeById.get(item.id);
                return previous && !same(fields(previous), fields(item));
            })
            .map(fields),
    };
}

/** Retorna null quando nada precisa ser gravado. */
export function diffState(before: AppState, after: AppState): Changeset | null {
    const categoryDiff = diffById(before.categories, after.categories, c => c);
    const productDiff = diffById(before.products, after.products, fieldsOf);
    const afterIds = new Set(after.products.map(p => p.id));

    const oldPurchases = purchaseMap(before);
    const newPurchases = purchaseMap(after);
    const deletedPurchases = [...oldPurchases.entries()]
        .filter(([key, p]) => !newPurchases.has(key) && afterIds.has(p.productId))
        .map(([, { productId, cycle }]) => ({ productId, cycle }));
    const upsertedPurchases = [...newPurchases.entries()]
        .filter(([key, p]) => !same(oldPurchases.get(key), p))
        .map(([, p]) => p);

    const settings = same(settingsOf(before), settingsOf(after)) ? null : settingsOf(after);

    const changes: Changeset = {
        deletedCategoryIds: categoryDiff.deleted,
        categories: categoryDiff.changed,
        deletedProductIds: productDiff.deleted,
        products: productDiff.changed,
        deletedPurchases,
        upsertedPurchases,
        settings,
    };
    const empty = Object.values(changes).every(value => value === null || (Array.isArray(value) && value.length === 0));
    return empty ? null : changes;
}
