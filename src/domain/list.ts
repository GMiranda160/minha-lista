/* =================================================================
   Lista atual: seleção, quantidades, filtros e ordenação.
   ================================================================= */

import { categoryOf } from './categories';
import { calculateScore } from './pattern';
import { scoreContext } from './recommendations';
import { findProduct, produce } from './state';
import { compareNames, matchesSearch } from './text';
import type { AppState, Category, ListItem, Product, ProductInput, SortMode } from './types';

export interface CategoryGroup {
    category: Category;
    products: Product[];
}

/**
 * Agrupa produtos na ordem das categorias. Produtos cuja categoria não existe
 * mais aparecem no fim, em "Sem categoria". Grupos vazios são omitidos.
 */
function groupByCategory(state: AppState, products: Product[], compare: (a: Product, b: Product) => number): CategoryGroup[] {
    const groups = new Map<number, CategoryGroup>(state.categories.map(c => [c.id, { category: c, products: [] }]));
    products.forEach(product => {
        const category = categoryOf(state, product);
        if (!groups.has(category.id)) groups.set(category.id, { category, products: [] });
        groups.get(category.id)!.products.push(product);
    });
    return [...groups.values()]
        .filter(group => group.products.length > 0)
        .map(group => ({ ...group, products: group.products.sort(compare) }));
}

const byName = (a: Product, b: Product) => compareNames(a.name, b.name);

/** Produtos visíveis que batem com a busca, agrupados por categoria e ordenados. */
export function groupVisibleProducts(state: AppState, searchTerm: string, now = new Date()): CategoryGroup[] {
    const ctx = scoreContext(state, now);
    const dir = state.sortDirection === 'desc' ? -1 : 1;
    const scores = new Map<number, number>();
    const scoreOf = (p: Product) => {
        if (!scores.has(p.id)) scores.set(p.id, calculateScore(p, ctx));
        return scores.get(p.id)!;
    };
    const compare = state.sortMode === 'frequency'
        ? (a: Product, b: Product) => (scoreOf(b) - scoreOf(a)) * dir || compareNames(a.name, b.name)
        : (a: Product, b: Product) => byName(a, b) * dir;

    const visible = state.products.filter(p => p.visible && matchesSearch(p.name, searchTerm));
    return groupByCategory(state, visible, compare);
}

export function selectedProducts(state: AppState): Product[] {
    return state.products.filter(p => p.selected).sort(byName);
}

export function selectedListItems(state: AppState): ListItem[] {
    return selectedProducts(state)
        .filter(p => p.quantity > 0)
        .map(p => ({ name: p.name, quantity: p.quantity }));
}

export function toggleSelection(state: AppState, productId: number): AppState {
    return produce(state, draft => {
        const product = findProduct(draft, productId);
        if (!product) return;
        product.selected = !product.selected;
        product.quantity = 1;
    });
}

/** Quantidade menor ou igual a zero remove o produto da lista. */
export function setQuantity(state: AppState, productId: number, quantity: number): AppState {
    return produce(state, draft => {
        const product = findProduct(draft, productId);
        if (!product) return;
        if (Number.isFinite(quantity) && quantity > 0) {
            product.selected = true;
            product.quantity = Math.floor(quantity);
        } else {
            product.selected = false;
            product.quantity = 1;
        }
    });
}

export function clearSelection(state: AppState): AppState {
    return produce(state, draft => {
        draft.products.forEach(product => {
            product.selected = false;
            product.quantity = 1;
        });
    });
}

/** Clicar no modo atual inverte a direção; outro modo começa ascendente. */
export function changeSort(state: AppState, mode: SortMode): AppState {
    return produce(state, draft => {
        if (draft.sortMode === mode) {
            draft.sortDirection = draft.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            draft.sortMode = mode;
            draft.sortDirection = 'asc';
        }
    });
}

/* -------------------------------------------------------------
   CATÁLOGO
   ------------------------------------------------------------- */

/** Catálogo inteiro (inclusive ocultos) filtrado e agrupado por categoria. */
export function groupCatalog(state: AppState, searchTerm: string, categoryId: number | 'all'): CategoryGroup[] {
    const filtered = state.products.filter(p =>
        (categoryId === 'all' || p.categoryId === categoryId) && matchesSearch(p.name, searchTerm));
    return groupByCategory(state, filtered, byName);
}

/** Inclui um produto já criado no servidor (com id definitivo). */
export function addProduct(state: AppState, product: Product): AppState {
    return produce(state, draft => { draft.products.push(product); });
}

export function updateProduct(state: AppState, productId: number, input: ProductInput): AppState {
    return produce(state, draft => {
        const product = findProduct(draft, productId);
        if (product) Object.assign(product, input);
    });
}

export function removeProduct(state: AppState, productId: number): AppState {
    return produce(state, draft => {
        draft.products = draft.products.filter(p => p.id !== productId);
    });
}

/** Ocultar um produto o tira da lista e congela o padrão dele. */
export function toggleVisibility(state: AppState, productId: number): AppState {
    return produce(state, draft => {
        const product = findProduct(draft, productId);
        if (!product) return;
        product.visible = !product.visible;
        product.selected = false;
        product.quantity = 1;
    });
}
