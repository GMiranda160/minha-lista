/* =================================================================
   Relatórios: agregações sobre o catálogo e o histórico de ciclos.
   ================================================================= */

import { CATEGORY_KEYS } from './constants';
import { getAllCycles } from './cycles';
import { calculateScore, calculateUrgency, frequencyPercent, type ScoreContext } from './pattern';
import { compareNames, monthOf } from './text';
import type { AppState, Category, Product } from './types';

export interface RankedItem {
    name: string;
    count: number;
    /** Percentual relativo usado para desenhar a barra (0 a 100). */
    pct: number;
}

export type CategoryTotals = Record<Category, number>;

const emptyCategoryTotals = (): CategoryTotals =>
    Object.fromEntries(CATEGORY_KEYS.map(k => [k, 0])) as CategoryTotals;

export const productsWithHistory = (state: AppState): Product[] =>
    state.products.filter(p => p.pattern.appearCount > 0);

/** Itens mais frequentes de todas as listas (percentual sobre o total de ciclos). */
export function getTopItems(state: AppState): RankedItem[] {
    if (state.totalCycles === 0) return [];
    return productsWithHistory(state)
        .map(p => ({
            name: p.name,
            count: p.pattern.appearCount,
            pct: Math.round((p.pattern.appearCount / state.totalCycles) * 100),
        }))
        .sort((a, b) => b.count - a.count);
}

/** Média de aparições por lista, por categoria. */
export function getCategoryAverages(state: AppState): CategoryTotals {
    const totals = emptyCategoryTotals();
    if (state.totalCycles === 0) return totals;
    productsWithHistory(state).forEach(p => { totals[p.category] += p.pattern.appearCount; });
    CATEGORY_KEYS.forEach(k => { totals[k] = totals[k] / state.totalCycles; });
    return totals;
}

/** Aparições por mês (0 a 11) somando todos os produtos. */
export function getMonthlyTotals(state: AppState): number[] {
    const monthly = Array<number>(12).fill(0);
    state.products.forEach(p => {
        Object.entries(p.pattern.monthlyAppearances).forEach(([month, count]) => {
            monthly[Number(month)] += count;
        });
    });
    return monthly;
}

export interface MonthOverview {
    totalAppearances: number;
    totalProducts: number;
    cycleCount: number;
    items: RankedItem[];
    categories: CategoryTotals;
}

export function getMonthOverview(state: AppState, month: number): MonthOverview {
    const categories = emptyCategoryTotals();
    const counted = state.products
        .map(p => ({ product: p, count: p.pattern.monthlyAppearances[month] || 0 }))
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count);
    counted.forEach(x => { categories[x.product.category] += x.count; });

    const max = Math.max(1, counted[0]?.count ?? 1);
    const cycleCount = getAllCycles(state).filter(c => monthOf(c.date) === month).length;

    return {
        totalAppearances: counted.reduce((s, x) => s + x.count, 0),
        totalProducts: counted.length,
        cycleCount,
        items: counted.map(x => ({ name: x.product.name, count: x.count, pct: Math.min(100, (x.count / max) * 100) })),
        categories,
    };
}

export interface AnalysisRow {
    name: string;
    freq: number;
    urgency: number;
    score: number;
    cv: number;
    phase: string;
    type: string;
    state: string;
    cyclesSince: number;
    skips: number;
}

const round2 = (value: number) => Number(value.toFixed(2));

/** Tabela técnica com os números do motor de recomendação. */
export function getAnalysisRows(state: AppState, ctx: ScoreContext): AnalysisRow[] {
    return state.products
        .filter(p => p.pattern.totalLists > 0)
        .map(p => {
            const pp = p.pattern;
            return {
                name: p.name,
                freq: round2(pp.appearCount / pp.totalLists),
                urgency: round2(calculateUrgency(p, ctx.totalCycles)),
                score: round2(calculateScore(p, ctx)),
                cv: pp.avgIntervalCycles > 0 ? round2(pp.intervalCycleStdDev / pp.avgIntervalCycles) : 0,
                phase: pp.confidencePhase,
                type: pp.patternType,
                state: pp.patternBroken ? 'broken' : pp.patternState,
                cyclesSince: state.totalCycles - pp.lastPurchaseListIndex,
                skips: pp.skipsSinceLastPurchase || 0,
            };
        })
        .sort((a, b) => b.score - a.score);
}

/** CV médio dos padrões estabelecidos (quanto menor, mais previsível). */
export function getPatternHealth(state: AppState): { avgCV: number; establishedCount: number } {
    const established = state.products
        .map(p => p.pattern)
        .filter(pp => pp.confidencePhase === 'established' && pp.avgIntervalCycles > 0);
    const sum = established.reduce((s, pp) => s + pp.intervalCycleStdDev / pp.avgIntervalCycles, 0);
    return {
        avgCV: established.length > 0 ? Number((sum / established.length).toFixed(3)) : 0,
        establishedCount: established.length,
    };
}

export type PatternStatus = 'established' | 'learning' | 'broken' | 'insufficient';

export function patternStatus(product: Product): PatternStatus {
    const pp = product.pattern;
    if (pp.patternBroken) return 'broken';
    if (pp.confidencePhase === 'established' || pp.confidencePhase === 'learning') return pp.confidencePhase;
    return 'insufficient';
}

export interface ProductSummary {
    product: Product;
    freqPct: number;
    score: number;
    status: PatternStatus;
}

/** Produtos visíveis com histórico, para a grade da análise por produto. */
export function getProductSummaries(state: AppState, ctx: ScoreContext): ProductSummary[] {
    return productsWithHistory(state)
        .filter(p => p.visible)
        .sort((a, b) => compareNames(a.name, b.name))
        .map(product => ({
            product,
            freqPct: state.totalCycles > 0 ? Math.round((product.pattern.appearCount / state.totalCycles) * 100) : 0,
            score: calculateScore(product, ctx),
            status: patternStatus(product),
        }));
}

export function getProductDetail(product: Product) {
    const totalQty = product.history.reduce((s, p) => s + p.quantity, 0);
    return {
        totalQty,
        avgQty: product.history.length > 0 ? Math.round(totalQty / product.history.length) : 0,
        freqPct: frequencyPercent(product),
    };
}
