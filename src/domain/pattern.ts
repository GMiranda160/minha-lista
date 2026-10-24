/* =================================================================
   Padrão de compra: intervalos, urgência e score, medidos em ciclos.
   ================================================================= */

import {
    ESTABLISHED_THRESHOLD, SCORE_WEIGHTS, URGENCY_ALPHA, URGENCY_DECAY,
} from './constants';
import type { Product, PurchasePattern } from './types';

/** Contexto de cálculo: ciclo atual e mês atual (0 a 11). */
export interface ScoreContext {
    totalCycles: number;
    month: number;
}

export function createDefaultPattern(): PurchasePattern {
    return {
        totalLists: 0,
        appearCount: 0,
        avgQuantity: 1,
        avgIntervalCycles: 0,
        intervalCycleStdDev: 0,
        patternType: 'insufficient',
        confidencePhase: 'insufficient',
        lastPurchaseListIndex: 0,
        lastDecayListIndex: 0,
        monthlyAppearances: {},
        skipsSinceLastPurchase: 0,
        patternBroken: false,
        consecutiveSelections: 0,
        patternState: 'insufficient',
        patternBreakListIndex: 0,
        shortTermInterval: 0,
        shortTermCV: 0,
        longTermInterval: 0,
        intervalHistory: [],
    };
}

export function syncPatternState(pp: PurchasePattern): void {
    if (!pp.patternBroken) pp.patternState = pp.confidencePhase;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

const variance = (values: number[], avg: number) =>
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;

/**
 * Shrinkage do CV com pseudocontagens (prior de Laplace): com poucos intervalos o
 * CV é instável (ex.: n=2 dá CV=0 espúrio). Puxa o valor para um "semi-regular" neutro.
 */
function smoothCV(cv: number, samples: number): number {
    const K = 2;
    const priorCV = 0.5;
    return (samples * cv + K * priorCV) / (samples + K);
}

function resetIntervals(pp: PurchasePattern): void {
    pp.avgIntervalCycles = 0;
    pp.intervalCycleStdDev = 0;
    pp.patternType = 'insufficient';
    pp.confidencePhase = 'insufficient';
    pp.shortTermInterval = 0;
    pp.shortTermCV = 0;
    pp.longTermInterval = 0;
    pp.intervalHistory = [];
}

/** Recalcula intervalos, fase de confiança e tipo de padrão a partir do histórico. */
export function calculateIntervalStats(product: Product): void {
    const pp = product.pattern;
    const history = product.history;
    if (history.length < 2) {
        resetIntervals(pp);
        return;
    }

    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
        const diff = history[i].cycle - history[i - 1].cycle;
        if (diff > 0) intervals.push(diff);
    }
    if (intervals.length === 0) {
        resetIntervals(pp);
        return;
    }

    const avgAll = mean(intervals);
    const stdDevAll = Math.sqrt(variance(intervals, avgAll));
    const cvAll = avgAll > 0 ? stdDevAll / avgAll : 1.0;

    const recent = intervals.slice(-Math.min(intervals.length, 4));
    const avgRecent = mean(recent);
    const cvRecent = avgRecent > 0 ? Math.sqrt(variance(recent, avgRecent)) / avgRecent : 1.0;

    const appearances = history.length;
    pp.avgIntervalCycles = round(avgAll, 1);
    pp.intervalCycleStdDev = round(stdDevAll, 1);
    pp.shortTermInterval = round(avgRecent, 1);
    pp.shortTermCV = round(cvRecent, 2);
    pp.longTermInterval = round(avgAll, 1);
    pp.intervalHistory = intervals.slice(-10);

    if (appearances >= ESTABLISHED_THRESHOLD) pp.confidencePhase = 'established';
    else pp.confidencePhase = 'learning';

    const cv = pp.patternBroken ? cvRecent : smoothCV(cvAll, intervals.length);
    if (pp.patternBroken) pp.patternType = 'irregular';
    else if (avgAll >= 8 && appearances >= 3) pp.patternType = 'sporadic';
    else if (cv < 0.3) pp.patternType = 'regular';
    else if (cv < 0.6) pp.patternType = 'semi-regular';
    else pp.patternType = 'irregular';

    if (!pp.patternBroken && pp.confidencePhase === 'established') {
        const drift = Math.abs(avgRecent - avgAll) / Math.max(avgAll, 0.1);
        if (drift > 0.5 && appearances >= 6) pp.patternType = 'declining';
    }
    pp.lastPurchaseListIndex = history[history.length - 1].cycle;
    syncPatternState(pp);
}

/** Urgência de reposição (0 a 1) considerando quantos ciclos passaram desde a última compra. */
export function calculateUrgency(product: Product, totalCycles: number): number {
    const pp = product.pattern;
    if (pp.lastPurchaseListIndex === 0 || pp.appearCount < 1 || pp.patternBroken) return 0;

    const minPurchases = pp.patternType === 'regular' && pp.avgIntervalCycles > 3 ? 2 : 3;
    if (pp.appearCount < minPurchases) return 0;

    const cyclesSince = totalCycles - pp.lastPurchaseListIndex;
    if (cyclesSince <= 0) return 0;

    const skips = pp.skipsSinceLastPurchase || 0;
    const expectedInterval = pp.avgIntervalCycles > 0 ? pp.avgIntervalCycles : 3;
    if (skips >= expectedInterval * 2) return 0;

    const overdueRatio = pp.avgIntervalCycles > 0 ? cyclesSince / pp.avgIntervalCycles : 0;
    const overdueDecay = () => Math.exp(-URGENCY_DECAY * (overdueRatio - 1.0));
    const saturating = () => 1 - Math.exp(-URGENCY_ALPHA * overdueRatio);

    let urgency: number;
    switch (pp.patternType) {
        case 'regular':
            urgency = overdueRatio <= 1.0
                ? (1 - Math.cos(overdueRatio ** 3 * Math.PI)) / 2
                : overdueDecay();
            break;
        case 'semi-regular':
            if (overdueRatio <= 0.7) urgency = 0;
            else if (overdueRatio <= 1.0) urgency = (overdueRatio - 0.7) / 0.3;
            else urgency = overdueDecay();
            break;
        case 'sporadic':
            urgency = saturating();
            break;
        case 'declining':
            urgency = 0.3 + 0.7 * saturating();
            break;
        default:
            urgency = overdueRatio <= 1.0 ? saturating() : overdueDecay();
    }

    if (skips >= expectedInterval) urgency *= 0.3;
    if (pp.confidencePhase === 'learning') urgency *= 0.5;

    return Math.max(0, Math.min(1, urgency));
}

const WEIGHTS_BY_TYPE: Partial<Record<PurchasePattern['patternType'], Partial<typeof SCORE_WEIGHTS>>> = {
    regular: { consistencyBonus: 0.15, frequency: 0.35, urgency: 0.40 },
    'semi-regular': { consistencyBonus: 0.10, frequency: 0.40, urgency: 0.40 },
    sporadic: { consistencyBonus: 0.05, frequency: 0.50, urgency: 0.35 },
    declining: { consistencyBonus: 0.05, frequency: 0.30, urgency: 0.55 },
};

/** Score de recomendação (0 a 1): frequência, urgência, sazonalidade e consistência. */
export function calculateScore(product: Product, ctx: ScoreContext): number {
    const pp = product.pattern;
    if (pp.totalLists === 0) return 0;

    const weights = { ...SCORE_WEIGHTS, ...WEIGHTS_BY_TYPE[pp.patternType] };
    const frequency = pp.appearCount / pp.totalLists;

    let consistencyBonus = 0;
    const intervals = pp.intervalHistory || [];
    if (pp.patternType !== 'insufficient' && pp.avgIntervalCycles > 0 && intervals.length >= 1) {
        const rawCV = Math.sqrt(variance(intervals, pp.avgIntervalCycles)) / pp.avgIntervalCycles;
        consistencyBonus = weights.consistencyBonus * Math.max(0, 1 - smoothCV(rawCV, intervals.length));
    }

    const urgency = calculateUrgency(product, ctx.totalCycles);

    let seasonal = 0;
    const monthCount = pp.monthlyAppearances?.[ctx.month];
    if (monthCount !== undefined) {
        const monthsWithData = Object.keys(pp.monthlyAppearances).length;
        if (monthsWithData > 0) seasonal = Math.min(monthCount / monthsWithData, 1.0);
    }

    const total = frequency * weights.frequency + urgency * weights.urgency +
        seasonal * weights.seasonal + consistencyBonus;
    return Math.min(total, pp.patternBroken ? 0.50 : 1.0);
}

/** Percentual de listas em que o produto apareceu. */
export function frequencyPercent(product: Product): number {
    const pp = product.pattern;
    return pp.totalLists > 0 ? Math.round((pp.appearCount / pp.totalLists) * 100) : 0;
}

/** Texto curto do intervalo médio ("toda lista", "a cada 3 listas"). */
export function cycleLabel(pp: PurchasePattern): string {
    const cycles = Math.round(pp.avgIntervalCycles);
    return cycles <= 1 ? 'toda lista' : `a cada ${cycles} listas`;
}
