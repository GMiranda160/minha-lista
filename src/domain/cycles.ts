/* =================================================================
   Ciclos de compra: registrar uma lista impressa, decaimento,
   reconstrução dos padrões e edição de ciclos existentes.
   ================================================================= */

import { DECAY_FACTOR, DECAY_INTERVAL } from './constants';
import { calculateIntervalStats, createDefaultPattern } from './pattern';
import { findProduct, normalizeHistory, produce } from './state';
import { monthOf, toIsoDate } from './text';
import type { AppState, Cycle, Product } from './types';

/* -------------------------------------------------------------
   REGISTRO DE UMA LISTA (novo ciclo)
   ------------------------------------------------------------- */

function recordPurchase(product: Product, cycle: number, date: string, month: number): void {
    const pp = product.pattern;
    product.history.push({ cycle, date, quantity: product.quantity });

    pp.totalLists++;
    pp.appearCount++;
    pp.lastPurchaseListIndex = cycle;
    pp.skipsSinceLastPurchase = 0;

    if (pp.patternBroken) {
        pp.consecutiveSelections++;
        if (pp.consecutiveSelections >= 3) {
            pp.patternBroken = false;
            pp.consecutiveSelections = 0;
            pp.patternState = pp.confidencePhase;
        }
    }

    const count = pp.appearCount;
    pp.avgQuantity = count > 0
        ? Number((((pp.avgQuantity * (count - 1)) + product.quantity) / count).toFixed(2))
        : product.quantity;
    pp.monthlyAppearances[month] = (pp.monthlyAppearances[month] || 0) + 1;

    calculateIntervalStats(product);
}

function recordSkip(product: Product, cycle: number): void {
    const pp = product.pattern;
    pp.totalLists++;
    pp.skipsSinceLastPurchase++;

    if (pp.patternBroken) {
        pp.consecutiveSelections = 0;
    } else if (pp.confidencePhase === 'established' || pp.confidencePhase === 'learning') {
        const expectedInterval = pp.avgIntervalCycles > 0 ? pp.avgIntervalCycles : 3;
        if (pp.skipsSinceLastPurchase >= expectedInterval * 2) {
            pp.patternBroken = true;
            pp.consecutiveSelections = 0;
            pp.patternState = 'transitioning';
            pp.patternBreakListIndex = cycle;
        }
    }
}

/**
 * Registra a lista atual como um novo ciclo: produtos selecionados contam como
 * compra, os visíveis não selecionados como "pulo". Produtos ocultos ficam
 * congelados. Ao final a seleção é limpa.
 */
export function registerList(state: AppState, now: Date): AppState {
    return produce(state, draft => {
        draft.totalCycles++;
        const cycle = draft.totalCycles;
        const date = toIsoDate(now);
        const month = now.getMonth();

        draft.products.forEach(product => {
            if (product.selected && product.quantity > 0) recordPurchase(product, cycle, date, month);
            else if (product.visible) recordSkip(product, cycle);
            product.selected = false;
            product.quantity = 1;
        });

        applyDecayIfDue(draft);
    });
}

/* -------------------------------------------------------------
   DECAIMENTO SELETIVO
   Produtos sem compra há muito tempo perdem peso aos poucos.
   ------------------------------------------------------------- */

function applySelectiveDecay(draft: AppState): boolean {
    let decayedAny = false;
    draft.products.forEach(product => {
        const pp = product.pattern;
        if (pp.appearCount === 0) return;

        const lastRelevant = Math.max(pp.lastPurchaseListIndex, pp.lastDecayListIndex);
        const cyclesSince = draft.totalCycles - lastRelevant;
        const threshold = pp.avgIntervalCycles > 0
            ? Math.max(DECAY_INTERVAL, Math.round(pp.avgIntervalCycles * 3))
            : DECAY_INTERVAL;
        if (cyclesSince < threshold || cyclesSince <= 0) return;

        pp.appearCount = Math.max(1, Math.round(pp.appearCount * DECAY_FACTOR));
        pp.avgQuantity = Math.max(1, Number((pp.avgQuantity * DECAY_FACTOR + 0.15).toFixed(2)));
        Object.keys(pp.monthlyAppearances).forEach(m => {
            pp.monthlyAppearances[m] = Math.max(0, Math.round(pp.monthlyAppearances[m] * DECAY_FACTOR));
        });
        pp.lastDecayListIndex = draft.totalCycles;
        decayedAny = true;
    });
    return decayedAny;
}

function applyDecayIfDue(draft: AppState): void {
    if (draft.totalCycles - draft.lastDecayCheck < DECAY_INTERVAL) return;
    if (applySelectiveDecay(draft)) draft.lastDecayCheck = draft.totalCycles;
}

/* -------------------------------------------------------------
   CONSULTA DE CICLOS
   ------------------------------------------------------------- */

export function getAllCycles(state: AppState): Cycle[] {
    const cycles = new Map<number, Cycle>();
    state.products.forEach(product => {
        product.history.forEach(purchase => {
            let cycle = cycles.get(purchase.cycle);
            if (!cycle) {
                cycle = { number: purchase.cycle, date: purchase.date, items: [] };
                cycles.set(purchase.cycle, cycle);
            }
            if (purchase.date < cycle.date) cycle.date = purchase.date;
            cycle.items.push({
                productId: product.id,
                productName: product.name,
                category: product.category,
                quantity: purchase.quantity,
            });
        });
    });
    return [...cycles.values()].sort((a, b) => a.number - b.number);
}

/* -------------------------------------------------------------
   RECONSTRUÇÃO DOS PADRÕES
   Renumera os ciclos por data e recalcula tudo a partir do histórico.
   ------------------------------------------------------------- */

function rebuildPatterns(draft: AppState): void {
    const cycleDates = new Map<number, string>();
    draft.products.forEach(p => p.history.forEach(({ cycle, date }) => {
        const known = cycleDates.get(cycle);
        if (known === undefined || date < known) cycleDates.set(cycle, date);
    }));

    const sortedCycles = [...cycleDates.keys()].sort((a, b) => {
        const da = cycleDates.get(a)!;
        const db = cycleDates.get(b)!;
        return da === db ? a - b : da.localeCompare(db);
    });
    const renumber = new Map(sortedCycles.map((cycle, index) => [cycle, index + 1]));
    const total = sortedCycles.length;

    draft.totalCycles = total;
    draft.products.forEach(product => {
        product.history = normalizeHistory(
            product.history.map(p => ({ ...p, cycle: renumber.get(p.cycle) ?? p.cycle })),
        );
        const history = product.history;
        const pp = { ...createDefaultPattern(), ...product.pattern };

        pp.appearCount = history.length;
        pp.totalLists = total;
        pp.avgQuantity = history.length > 0
            ? Number((history.reduce((s, p) => s + p.quantity, 0) / history.length).toFixed(2))
            : 1;
        pp.monthlyAppearances = {};
        history.forEach(p => {
            const month = monthOf(p.date);
            pp.monthlyAppearances[month] = (pp.monthlyAppearances[month] || 0) + 1;
        });
        pp.lastPurchaseListIndex = history.length > 0 ? history[history.length - 1].cycle : 0;
        pp.skipsSinceLastPurchase = pp.lastPurchaseListIndex > 0 ? total - pp.lastPurchaseListIndex : 0;
        product.pattern = pp;

        calculateIntervalStats(product);

        if (pp.confidencePhase === 'established' || pp.confidencePhase === 'learning') {
            const expectedInterval = pp.avgIntervalCycles > 0 ? pp.avgIntervalCycles : 3;
            pp.patternBroken = pp.skipsSinceLastPurchase >= expectedInterval * 2;
        } else {
            pp.patternBroken = false;
        }
        pp.consecutiveSelections = 0;
    });

    draft.lastDecayCheck = draft.totalCycles;
}

/* -------------------------------------------------------------
   EDIÇÃO DE CICLOS
   ------------------------------------------------------------- */

/** Altera quantidades de um ciclo (não muda a numeração nem o padrão). */
export function setCycleQuantities(state: AppState, cycle: number, quantities: Record<number, number>): AppState {
    return produce(state, draft => {
        Object.entries(quantities).forEach(([productId, quantity]) => {
            const product = findProduct(draft, Number(productId));
            const purchase = product?.history.find(p => p.cycle === cycle);
            if (!product || !purchase || !(quantity > 0)) return;
            purchase.quantity = quantity;
            const total = product.history.reduce((s, p) => s + p.quantity, 0);
            product.pattern.avgQuantity = Number((total / product.history.length).toFixed(2));
        });
    });
}

export function removeCycleItem(state: AppState, cycle: number, productId: number): AppState {
    return produce(state, draft => {
        const product = findProduct(draft, productId);
        if (!product) return;
        product.history = product.history.filter(p => p.cycle !== cycle);
        rebuildPatterns(draft);
    });
}

export function addCycleItem(state: AppState, cycle: number, productId: number, quantity: number): AppState {
    const target = getAllCycles(state).find(c => c.number === cycle);
    return produce(state, draft => {
        const product = findProduct(draft, productId);
        if (!product || !target || product.history.some(p => p.cycle === cycle)) return;
        product.history = normalizeHistory([...product.history, { cycle, date: target.date, quantity: Math.max(1, quantity) }]);
        rebuildPatterns(draft);
    });
}

export function deleteCycle(state: AppState, cycle: number): AppState {
    return produce(state, draft => {
        draft.products.forEach(product => {
            product.history = product.history.filter(p => p.cycle !== cycle);
        });
        rebuildPatterns(draft);
    });
}

/** Adiciona um ciclo vindo de arquivo e reposiciona todos os ciclos pela data. */
export function importCycle(
    state: AppState,
    date: string,
    items: { productId: number; quantity: number }[],
): AppState {
    return produce(state, draft => {
        const cycle = draft.totalCycles + 1;
        items.forEach(item => {
            const product = findProduct(draft, item.productId);
            if (!product || product.history.some(p => p.cycle === cycle)) return;
            product.history.push({ cycle, date, quantity: item.quantity });
        });
        rebuildPatterns(draft);
    });
}
