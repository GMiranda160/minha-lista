/* =================================================================
   Estado da aplicação: normalização e cópia imutável.
   Toda operação do domínio recebe um estado e devolve um estado novo.
   ================================================================= */

import { MISSING_CATEGORY } from './constants';
import { createDefaultPattern } from './pattern';
import type { AppState, Product, Purchase, PurchasePattern } from './types';

/** Ordena por ciclo e mantém uma única compra por ciclo. */
export function normalizeHistory(history: Purchase[]): Purchase[] {
    const byCycle = new Map<number, Purchase>();
    history
        .filter(p => Number.isInteger(p.cycle) && p.cycle > 0)
        .forEach(p => { if (!byCycle.has(p.cycle)) byCycle.set(p.cycle, p); });
    return [...byCycle.values()].sort((a, b) => a.cycle - b.cycle);
}

export function normalizePattern(pattern: Partial<PurchasePattern> | null | undefined): PurchasePattern {
    return { ...createDefaultPattern(), ...(pattern ?? {}) };
}

type RawProduct = Partial<Omit<Product, 'pattern'>> & Pick<Product, 'id' | 'name'> & {
    pattern?: Partial<PurchasePattern> | null;
};

/** Garante campos válidos em um produto vindo de fora (banco ou arquivo). */
export function normalizeProduct(product: RawProduct): Product {
    return {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl ?? '',
        categoryId: Number.isInteger(product.categoryId) ? product.categoryId! : MISSING_CATEGORY.id,
        visible: product.visible !== false,
        selected: !!product.selected,
        quantity: typeof product.quantity === 'number' && product.quantity > 0 ? product.quantity : 1,
        history: normalizeHistory(product.history ?? []),
        pattern: normalizePattern(product.pattern),
    };
}

/**
 * Executa uma alteração sobre uma cópia profunda do estado.
 * Mantém o estilo direto dos algoritmos sem expor mutação para fora do domínio.
 */
export function produce(state: AppState, recipe: (draft: AppState) => void): AppState {
    const draft = structuredClone(state);
    recipe(draft);
    return draft;
}

export function findProduct(state: AppState, productId: number): Product | undefined {
    return state.products.find(p => p.id === productId);
}
