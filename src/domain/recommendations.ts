/* =================================================================
   Recomendações: quais produtos sugerir na próxima lista e em que quantidade.

   Cada produto recebe uma probabilidade de entrar na próxima lista (ver
   probability.ts): estimativa por produto suavizada pela taxa média da casa
   e corrigida por uma calibração global. Em backtest nas listas reais, 70%
   previsto corresponde a cerca de 70% real.
   A lista sugerida é o corte que maximiza o F1 esperado, ou seja, o
   melhor equilíbrio entre não esquecer itens e não sugerir demais.
   ================================================================= */

import { MIN_LISTS_FOR_RECOMMENDATION, SURE_PROBABILITY } from './constants';
import { frequencyPercent, type ScoreContext } from './pattern';
import { createProbability, exposure } from './probability';
import { produce } from './state';
import { plural } from './text';
import type { AppState, Product } from './types';

export interface Recommendation {
    product: Product;
    /** Probabilidade de compra, de 0 a 1. */
    score: number;
    context: string;
    recommendedQty: number;
}

export interface RecommendationGroups {
    /** Muito prováveis (probabilidade alta). */
    established: Recommendation[];
    /** Prováveis: entram na lista completa. */
    learning: Recommendation[];
}

export const hasEnoughData = (state: AppState) => state.totalCycles >= MIN_LISTS_FOR_RECOMMENDATION;

export const scoreContext = (state: AppState, now = new Date()): ScoreContext =>
    ({ totalCycles: state.totalCycles, month: now.getMonth() });

/** Mediana das últimas 3 compras (resistente a compras de tamanho atípico). */
function recentMedianQuantity(product: Product): number {
    const recent = product.history.slice(-3).map(p => p.quantity).filter(q => q > 0).sort((a, b) => a - b);
    if (recent.length === 0) return 0;
    const mid = Math.floor(recent.length / 2);
    return recent.length % 2 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2;
}

/** Quantidade sugerida: mediana das últimas compras, ou a média histórica. */
export function suggestedQuantity(product: Product): number {
    const median = recentMedianQuantity(product);
    return Math.max(1, Math.round(median > 0 ? median : product.pattern.avgQuantity));
}

export function describeRecommendation(product: Product, totalCycles: number): string {
    const bought = product.history.length;
    const lastCycle = product.history[bought - 1]?.cycle ?? 0;
    const since = totalCycles - lastCycle;
    const parts = [`${bought} de ${exposure(product)} listas (${frequencyPercent(product)}%)`];
    parts.push(since <= 0 ? 'na última lista' : `última há ${since} ${plural(since, 'lista')}`);
    return parts.join(' · ');
}

const byScore = (a: Recommendation, b: Recommendation) => b.score - a.score;

/** Separa em muito prováveis e prováveis, cada grupo do maior para o menor. */
export function groupRecommendations(recommendations: Recommendation[]): RecommendationGroups {
    return {
        established: recommendations.filter(r => r.score >= SURE_PROBABILITY).sort(byScore),
        learning: recommendations.filter(r => r.score < SURE_PROBABILITY).sort(byScore),
    };
}

/** Quantos itens (do mais provável para o menos) maximizam o F1 esperado. */
function bestCutoff(sortedDesc: number[]): number {
    const total = sortedDesc.reduce((sum, p) => sum + p, 0);
    let hits = 0;
    let best = 0;
    let cutoff = 0;
    sortedDesc.forEach((p, i) => {
        hits += p;
        const expectedF1 = (2 * hits) / (i + 1 + total);
        if (expectedF1 > best) { best = expectedF1; cutoff = i + 1; }
    });
    return cutoff;
}

/** Candidatos visíveis já comprados alguma vez, do mais para o menos provável. */
export function rankCandidates(state: AppState): Recommendation[] {
    const probability = createProbability(state);
    return state.products
        .filter(p => p.visible && p.history.length > 0)
        .map(product => ({
            product,
            score: probability(product),
            context: describeRecommendation(product, state.totalCycles),
            recommendedQty: suggestedQuantity(product),
        }))
        .sort(byScore);
}

/** Cálculo local (sem rede): serve de base para o Gemini e de plano B se ele falhar. */
export function generateRecommendations(state: AppState): RecommendationGroups {
    const ranked = rankCandidates(state);
    return groupRecommendations(ranked.slice(0, bestCutoff(ranked.map(r => r.score))));
}

/** Ids dos produtos muito prováveis (vazio enquanto não há listas suficientes). */
export function recommendedIds(state: AppState): Set<number> {
    if (!hasEnoughData(state)) return new Set();
    return new Set(generateRecommendations(state).established.map(r => r.product.id));
}

/** Substitui a seleção atual pelas recomendações recebidas (só produtos visíveis). */
export function applyRecommendations(state: AppState, recommendations: Pick<Recommendation, 'product' | 'recommendedQty'>[]): AppState {
    const chosen = new Map(recommendations.map(r => [r.product.id, r.recommendedQty]));
    return produce(state, draft => {
        draft.products.forEach(product => {
            const quantity = product.visible ? chosen.get(product.id) : undefined;
            product.selected = quantity !== undefined;
            product.quantity = quantity ?? 1;
        });
    });
}
