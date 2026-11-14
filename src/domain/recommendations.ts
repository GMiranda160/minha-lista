/* =================================================================
   Recomendações: quais produtos sugerir na próxima lista e em que quantidade.
   ================================================================= */

import { MIN_LISTS_FOR_RECOMMENDATION, RECOMMENDATION_THRESHOLD } from './constants';
import { calculateScore, calculateUrgency, cycleLabel, frequencyPercent, type ScoreContext } from './pattern';
import { produce } from './state';
import { plural } from './text';
import type { AppState, Product } from './types';

export interface Recommendation {
    product: Product;
    score: number;
    context: string;
    recommendedQty: number;
}

export interface RecommendationGroups {
    /** Padrão consolidado e já está na hora de comprar. */
    established: Recommendation[];
    /** Ainda aprendendo o padrão (ou reaprendendo após quebra). */
    learning: Recommendation[];
}

const PATTERN_DESCRIPTIONS: Record<string, string> = {
    regular: 'padrão regular',
    'semi-regular': 'padrão semi-regular',
    irregular: 'padrão irregular',
    sporadic: 'uso esporádico',
    declining: 'frequência diminuindo',
};

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

/** Padrão consolidado e sem quebra recente. */
export const isEstablished = (product: Product) =>
    product.pattern.confidencePhase === 'established' && !product.pattern.patternBroken;

export function describeRecommendation(product: Product, totalCycles: number): string {
    const pp = product.pattern;
    const parts: string[] = [];

    if (pp.confidencePhase === 'learning' || pp.patternBroken) {
        if (pp.patternBroken) {
            parts.push(`Padrão quebrado, reaprendendo · ${Math.min(pp.consecutiveSelections || 0, 3)}/3 seleções consistentes`);
        }
        parts.push(`Comprado ${pp.appearCount}x (${frequencyPercent(product)}% das listas)`);
        if (product.history.length > 0) {
            const first = product.history[0].cycle;
            const last = product.history[product.history.length - 1].cycle;
            parts.push(`Listas: #${first} a #${last}`);
        }
        const cyclesSince = pp.lastPurchaseListIndex > 0 ? totalCycles - pp.lastPurchaseListIndex : 0;
        if (cyclesSince > 0) parts.push(`Última há ${cyclesSince} ${plural(cyclesSince, 'ciclo')}`);
    } else if (pp.confidencePhase === 'established') {
        parts.push(`${frequencyPercent(product)}% das listas · ${cycleLabel(pp)}`);
        if (PATTERN_DESCRIPTIONS[pp.patternType]) parts.push(PATTERN_DESCRIPTIONS[pp.patternType]);
    } else {
        parts.push(`Comprado em ${frequencyPercent(product)}% das listas`);
    }

    const urgency = calculateUrgency(product, totalCycles);
    if (urgency > 0.8) parts.push('hora de repor');
    else if (urgency > 0.5) parts.push('em breve');

    return parts.slice(0, 3).join(' · ');
}

const byScore = (a: Recommendation, b: Recommendation) => b.score - a.score;

/** Separa em garantidos e em aprendizado, cada grupo do maior para o menor score. */
export function groupRecommendations(recommendations: Recommendation[]): RecommendationGroups {
    const established = recommendations.filter(r => isEstablished(r.product)).sort(byScore);
    const learning = recommendations.filter(r => !isEstablished(r.product)).sort(byScore);
    return { established, learning };
}

/** Cálculo local (sem rede): serve de base para o Gemini e de plano B se ele falhar. */
export function generateRecommendations(state: AppState, now = new Date()): RecommendationGroups {
    const ctx = scoreContext(state, now);
    const chosen: Recommendation[] = [];

    state.products.forEach(product => {
        const pp = product.pattern;
        if (!product.visible || pp.totalLists < 1) return;

        const score = calculateScore(product, ctx);
        if (score < RECOMMENDATION_THRESHOLD) return;

        if (isEstablished(product)) {
            const cyclesSince = state.totalCycles - pp.lastPurchaseListIndex;
            const dueThreshold = pp.avgIntervalCycles > 1 ? Math.round(pp.avgIntervalCycles * 0.7) : 0;
            if (cyclesSince < dueThreshold) return;
        }

        chosen.push({
            product,
            score,
            context: describeRecommendation(product, state.totalCycles),
            recommendedQty: suggestedQuantity(product),
        });
    });

    return groupRecommendations(chosen);
}

/** Ids dos produtos recomendados (vazio enquanto não há listas suficientes). */
export function recommendedIds(state: AppState, now = new Date()): Set<number> {
    if (!hasEnoughData(state)) return new Set();
    const { established, learning } = generateRecommendations(state, now);
    return new Set([...established, ...learning].map(r => r.product.id));
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
