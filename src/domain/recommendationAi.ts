/* =================================================================
   Recomendações com IA: monta os dados enviados ao Gemini e valida
   a resposta. Puro: a chamada de rede fica em src/services.
   ================================================================= */

import { categoryOf } from './categories';
import { AI_MAX_CANDIDATES, AI_REASON_MAX, MONTH_NAMES } from './constants';
import { createProbability } from './probability';
import {
    describeRecommendation, groupRecommendations, rankCandidates, suggestedQuantity,
    type Recommendation, type RecommendationGroups,
} from './recommendations';
import { toIsoDate } from './text';
import type { AppState, Product } from './types';

/** Uma escolha do Gemini: produto e o motivo em uma frase. A quantidade vem sempre do histórico. */
export interface AiPick {
    productId: number;
    reason: string;
}

/** Quantas das últimas listas aparecem no histórico compacto de cada produto. */
const HISTORY_WINDOW = 8;

export const AI_INSTRUCTIONS = `Você ajuda a montar a próxima lista de compras de supermercado de uma casa.
Cada "ciclo" é uma lista impressa (em geral semanal). Para cada produto você recebe o histórico e a "probabilidade_local" (0 a 100).
A probabilidade_local é calibrada: produtos com 70 foram comprados em cerca de 70% das listas parecidas. Comece sempre por ela.
Escolha os produtos que provavelmente entram na próxima lista. Regras:
- Use apenas ids que aparecem em "produtos". Não invente produtos.
- Só se afaste da probabilidade_local com motivo claro: alternância (comprado a cada duas listas e já veio na anterior), reposição atrasada, produtos que se substituem, época do ano, ou lista maior quando passaram muitos dias desde a última.
- "historico_ultimas_listas" tem uma letra por lista, da mais antiga para a mais recente: X comprou, ponto não comprou.
- Em dúvida, inclua produtos com probabilidade a partir de 35: é mais fácil desmarcar um item do que lembrar de um esquecido.
- "itens_nas_ultimas_listas" mostra o tamanho das listas recentes: mire em uma lista desse tamanho.
- Você escolhe só os produtos. A quantidade é calculada pelo app a partir do histórico (algumas são em gramas, como 300 ou 200), então não a informe.
- "motivo" é uma frase curta em português (até 80 caracteres), sem travessões.
- Responda somente o JSON pedido.`;

/** Formato de resposta exigido do Gemini (schema da API). */
export const AI_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        itens: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    id: { type: 'INTEGER' },
                    motivo: { type: 'STRING' },
                },
                required: ['id', 'motivo'],
            },
        },
    },
    required: ['itens'],
};

const percent = (value: number) => Math.round(value * 100);

/** Uma letra por lista recente: X comprou, ponto não comprou. */
function recentHistory(product: Product, totalCycles: number): string {
    const bought = new Set(product.history.map(p => p.cycle));
    const first = Math.max(1, totalCycles - HISTORY_WINDOW + 1);
    return Array.from({ length: totalCycles - first + 1 }, (_, i) => (bought.has(first + i) ? 'X' : '.')).join('');
}

function toCandidate(state: AppState, { product, score }: Recommendation) {
    const lastCycle = product.history[product.history.length - 1].cycle;
    return {
        id: product.id,
        nome: product.name,
        categoria: categoryOf(state, product).name,
        compras: product.history.length,
        probabilidade_local: percent(score),
        historico_ultimas_listas: recentHistory(product, state.totalCycles),
        ultima_compra_ha_listas: state.totalCycles - lastCycle,
        quantidade_sugerida: suggestedQuantity(product),
    };
}

/** Quantidade de itens e data de cada uma das últimas listas, da mais antiga para a mais recente. */
function recentLists(state: AppState, count = 4) {
    const perCycle = new Map<number, { items: number; date: string }>();
    state.products.forEach(p => p.history.forEach(h => {
        const entry = perCycle.get(h.cycle) ?? { items: 0, date: h.date };
        entry.items++;
        perCycle.set(h.cycle, entry);
    }));
    return [...perCycle.entries()].sort((a, b) => a[0] - b[0]).slice(-count).map(([, entry]) => entry);
}

const daysBetween = (fromIso: string, to: Date) =>
    Math.max(0, Math.round((to.getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 86_400_000));

/** Candidatos visíveis já comprados alguma vez, do mais para o menos provável (limitado). */
export function buildAiCandidates(state: AppState) {
    return rankCandidates(state).slice(0, AI_MAX_CANDIDATES).map(r => toCandidate(state, r));
}

/** Texto enviado ao Gemini: contexto da lista e os candidatos. */
export function buildAiPrompt(state: AppState, now = new Date()): string {
    const recent = recentLists(state);
    const lastDate = recent[recent.length - 1]?.date;
    return JSON.stringify({
        data_de_hoje: toIsoDate(now),
        mes_atual: MONTH_NAMES[now.getMonth()],
        ciclos_ja_impressos: state.totalCycles,
        dias_desde_a_ultima_lista: lastDate ? daysBetween(lastDate, now) : null,
        itens_nas_ultimas_listas: recent.map(r => r.items),
        produtos: buildAiCandidates(state),
    });
}

/** Lê e valida a resposta do Gemini, descartando itens malformados. */
export function parseAiPicks(text: string): AiPick[] {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new Error('O Gemini devolveu uma resposta em formato inválido.');
    }
    const items = (raw as { itens?: unknown })?.itens;
    if (!Array.isArray(items)) throw new Error('O Gemini devolveu uma resposta em formato inválido.');

    return items.flatMap((item): AiPick[] => {
        const { id, motivo } = (item ?? {}) as Record<string, unknown>;
        if (!Number.isInteger(id)) return [];
        const reason = typeof motivo === 'string' ? motivo.trim().slice(0, AI_REASON_MAX) : '';
        return [{ productId: id as number, reason }];
    });
}

/** Liga as escolhas aos produtos do estado atual; ids desconhecidos, ocultos ou repetidos são ignorados. */
export function resolveAiPicks(state: AppState, picks: AiPick[]): RecommendationGroups {
    const probability = createProbability(state);
    const byId = new Map(state.products.filter(p => p.visible).map(p => [p.id, p]));
    const seen = new Set<number>();
    const recommendations: Recommendation[] = [];

    picks.forEach(pick => {
        const product = byId.get(pick.productId);
        if (!product || seen.has(pick.productId)) return;
        seen.add(pick.productId);
        recommendations.push({
            product,
            score: probability(product),
            context: pick.reason || describeRecommendation(product, state.totalCycles),
            recommendedQty: suggestedQuantity(product),
        });
    });
    return groupRecommendations(recommendations);
}
