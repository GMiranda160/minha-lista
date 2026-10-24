/* =================================================================
   Categorias: consulta, validação e edição.
   ================================================================= */

import { CATEGORY_NAME_MAX, DEFAULT_CATEGORIES, MISSING_CATEGORY } from './constants';
import { produce } from './state';
import { sameName } from './text';
import type { AppState, Category, CategoryInput, Product } from './types';

export const byPosition = (a: Category, b: Category) => a.position - b.position || a.id - b.id;

export function findCategory(state: AppState, categoryId: number): Category | undefined {
    return state.categories.find(c => c.id === categoryId);
}

/** Categoria do produto, ou "Sem categoria" se ela não existir mais. */
export function categoryOf(state: AppState, product: Pick<Product, 'categoryId'>): Category {
    return findCategory(state, product.categoryId) ?? MISSING_CATEGORY;
}

export function countProducts(state: AppState, categoryId: number): number {
    return state.products.filter(p => p.categoryId === categoryId).length;
}

export function nextPosition(state: AppState): number {
    return state.categories.reduce((max, c) => Math.max(max, c.position), 0) + 1;
}

/** Nome da categoria padrão para uma chave fixa do app desktop (ex.: "armarios"). */
export function legacyCategoryName(key: string): string | undefined {
    return DEFAULT_CATEGORIES.find(d => d.legacyKey === key)?.name;
}

/**
 * Encontra a categoria de um item vindo de arquivo pelo nome ou pela chave
 * antiga do app desktop. Sem correspondência, usa a primeira categoria.
 */
export function resolveCategoryId(state: AppState, nameOrLegacyKey: string): number | undefined {
    const names = [nameOrLegacyKey, legacyCategoryName(nameOrLegacyKey)].filter((n): n is string => !!n);
    const match = state.categories.find(c => names.some(n => sameName(c.name, n)));
    return (match ?? state.categories[0])?.id;
}

/** Mensagem de erro do nome da categoria, ou null se estiver válido. */
export function validateCategoryName(state: AppState, name: string, editingId?: number): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Informe o nome da categoria.';
    if (trimmed.length > CATEGORY_NAME_MAX) return `Use no máximo ${CATEGORY_NAME_MAX} caracteres.`;
    if (state.categories.some(c => c.id !== editingId && sameName(c.name, trimmed))) {
        return 'Já existe uma categoria com esse nome.';
    }
    return null;
}

/** Inclui uma categoria já criada no servidor (com id definitivo). */
export function addCategory(state: AppState, category: Category): AppState {
    return produce(state, draft => {
        draft.categories = [...draft.categories, category].sort(byPosition);
    });
}

export function updateCategory(state: AppState, categoryId: number, input: CategoryInput): AppState {
    return produce(state, draft => {
        const category = findCategory(draft, categoryId);
        if (category) Object.assign(category, { ...input, name: input.name.trim() });
    });
}

/**
 * Remove a categoria e move os produtos dela para `moveToId`.
 * Sempre sobra pelo menos uma categoria.
 */
export function removeCategory(state: AppState, categoryId: number, moveToId?: number): AppState {
    const hasProducts = countProducts(state, categoryId) > 0;
    const destinationValid = moveToId !== undefined && moveToId !== categoryId && !!findCategory(state, moveToId);
    if (state.categories.length <= 1 || (hasProducts && !destinationValid)) return state;

    return produce(state, draft => {
        draft.products.forEach(p => { if (p.categoryId === categoryId) p.categoryId = moveToId!; });
        draft.categories = draft.categories.filter(c => c.id !== categoryId);
    });
}
