/* =================================================================
   Probabilidade de um produto entrar na próxima lista.

   1. Estimativa por produto: (compras + peso * taxa_média) / (listas + peso).
   2. Calibração global (regressão logística de 2 parâmetros): compara o que
      o passo 1 previu em cada lista passada com o que foi realmente comprado
      e corrige o viés da casa (ex.: palpites de 35% que acertam só 21%).
   Tudo é recalculado do histórico, então editar ou excluir um ciclo nunca
   deixa um valor guardado desatualizado.
   ================================================================= */

import {
    CALIBRATION_MAX_LISTS, CALIBRATION_MIN_LISTS, CALIBRATION_MIN_SAMPLES, CALIBRATION_SLOPE_PRIOR,
    DEFAULT_BASE_RATE, PROBABILITY_PRIOR_WEIGHT,
} from './constants';
import type { AppState, Product } from './types';

/** Listas em que o produto esteve disponível para ser comprado. */
export const exposure = (product: Product) => Math.max(product.pattern.totalLists, product.history.length);

/** Taxa média de compra dos produtos que já foram comprados alguma vez. */
export function baseRate(state: AppState): number {
    const rates = state.products.filter(p => p.history.length > 0).map(p => p.history.length / exposure(p));
    return rates.length ? rates.reduce((sum, r) => sum + r, 0) / rates.length : DEFAULT_BASE_RATE;
}

/** Estimativa por produto, antes da calibração. */
export function purchaseProbability(product: Product, base: number): number {
    return rawProbability(product.history.length, exposure(product), base);
}

const rawProbability = (bought: number, lists: number, base: number) =>
    (bought + PROBABILITY_PRIOR_WEIGHT * base) / (lists + PROBABILITY_PRIOR_WEIGHT);

/* ----------------------------- calibração ----------------------------- */

interface Calibration {
    intercept: number;
    slope: number;
}

const IDENTITY: Calibration = { intercept: 0, slope: 1 };
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clampProbability = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logit = (p: number) => Math.log(p / (1 - p));

/** [logit da previsão, comprou (0 ou 1)] de cada produto em cada lista recente. */
function reliabilitySamples(state: AppState): [number, number][] {
    const total = state.totalCycles;
    const first = Math.max(CALIBRATION_MIN_LISTS + 1, total - CALIBRATION_MAX_LISTS + 1);
    const samples: [number, number][] = [];
    const tracked = state.products
        .filter(p => p.history.length > 0)
        .map(product => {
            const bought = new Uint8Array(total + 2);
            product.history.forEach(h => { bought[h.cycle] = 1; });
            const before = new Int32Array(total + 2);
            for (let c = 1; c <= total; c++) before[c] = before[c - 1] + bought[c];
            return { bought, before, listsNow: exposure(product) };
        });

    for (let list = first; list <= total; list++) {
        const rows = tracked
            .map(t => {
                const k = t.before[list - 1];
                return { k, n: Math.max(k, t.listsNow - (total - (list - 1))), bought: t.bought[list] };
            })
            .filter(r => r.k > 0);
        if (rows.length === 0) continue;
        const base = rows.reduce((sum, r) => sum + r.k / r.n, 0) / rows.length;
        rows.forEach(r => samples.push([logit(clampProbability(rawProbability(r.k, r.n, base))), r.bought]));
    }
    return samples;
}

/** Ajusta p' = sigmoid(a + b * logit(p)) por Newton, com b puxado para 1. */
function fitCalibration(samples: [number, number][]): Calibration {
    if (samples.length < CALIBRATION_MIN_SAMPLES) return IDENTITY;
    let a = 0;
    let b = 1;
    for (let iteration = 0; iteration < 8; iteration++) {
        let ga = 0, gb = CALIBRATION_SLOPE_PRIOR * (b - 1);
        let haa = 0, hab = 0, hbb = CALIBRATION_SLOPE_PRIOR;
        samples.forEach(([x, y]) => {
            const p = sigmoid(a + b * x);
            const w = p * (1 - p);
            ga += p - y; gb += (p - y) * x;
            haa += w; hab += w * x; hbb += w * x * x;
        });
        const det = haa * hbb - hab * hab;
        if (!(det > 1e-9)) return IDENTITY;
        a -= (hbb * ga - hab * gb) / det;
        b -= (haa * gb - hab * ga) / det;
    }
    return Number.isFinite(a) && Number.isFinite(b) ? { intercept: a, slope: b } : IDENTITY;
}

/** Função de probabilidade calibrada para o estado atual. */
export function createProbability(state: AppState): (product: Product) => number {
    const base = baseRate(state);
    const { intercept, slope } = fitCalibration(reliabilitySamples(state));
    return product =>
        sigmoid(intercept + slope * logit(clampProbability(purchaseProbability(product, base))));
}
