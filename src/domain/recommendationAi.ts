/* =================================================================
   Recomendações com IA: monta os dados enviados ao Gemini e valida
   a resposta. Puro: a chamada de rede fica em src/services.
   ================================================================= */

import { categoryOf } from './categories';
import { AI_MAX_CANDIDATES, AI_MAX_QUANTITY, AI_REASON_MAX, MONTH_NAMES } from './constants';
import { calculateScore, calculateUrgency, frequencyPercent } from './pattern';
import {
    describeRecommendation, groupRecommendations, scoreContext, suggestedQuantity,
    type Recommendation, type RecommendationGroups,
} from './recommendations';
import { toIsoDate } from './text';
import type { AppState, Product } from './types';

/** Uma escolha do Gemini: produto, quantidade e o motivo em uma frase. */
export interface AiPick {
    productId: number;
    quantity: number;
    reason: string;
}

export const AI_INSTRUCTIONS = `Você ajuda a montar a próxima lista de compras de supermercado de uma casa.
Cada "ciclo" é uma lista impressa. Para cada produto você recebe o histórico de compras e métricas calculadas pelo app.
Escolha os produtos que provavelmente precisam ser comprados na próxima lista.
Regras:
- Use apenas ids que aparecem em "produtos". Não invente produtos.
- "pontuacao_local" e "urgencia_local" (0 a 100) são pistas do cálculo do app, não ordens. Você pode discordar.
- Considere o intervalo médio, quantos ciclos se passaram desde a última compra, a regularidade, a época do ano e se o padrão foi quebrado.
- Não recomende produtos com poucas compras e sem sinal de reposição.
- "quantidade" é um inteiro de 1 a ${AI_MAX_QUANTITY}, baseado nas quantidades recentes.
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
                    quantidade: { type: 'INTEGER' },
                    motivo: { type: 'STRING' },
                },
                required: ['id', 'quantidade', 'motivo'],
            },
        },
    },
    required: ['itens'],
};

const percent = (value: number) => Math.round(value * 100);

function toCandidate(state: AppState, product: Product, score: number) {
    const pp = product.pattern;
    return {
        id: product.id,
        nome: product.name,
        categoria: categoryOf(state, product).name,
        compras: pp.appearCount,
        listas_desde_o_cadastro: pp.totalLists,
        frequencia_pct: frequencyPercent(product),
        ciclos_desde_a_ultima_compra: pp.lastPurchaseListIndex > 0 ? state.totalCycles - pp.lastPurchaseListIndex : null,
        intervalo_medio_ciclos: pp.avgIntervalCycles,
        desvio_do_intervalo: pp.intervalCycleStdDev,
        tipo_de_padrao: pp.patternType,
        fase: pp.confidencePhase,
        padrao_quebrado: pp.patternBroken,
        quantidade_sugerida: suggestedQuantity(product),
        ultimas_compras: product.history.slice(-5).map(p => ({ ciclo: p.cycle, data: p.date, quantidade: p.quantity })),
        pontuacao_local: percent(score),
        urgencia_local: percent(calculateUrgency(product, state.totalCycles)),
    };
}

/** Produtos visíveis já comprados alguma vez, do maior para o menor score local (limitado). */
export function buildAiCandidates(state: AppState, now = new Date()) {
    const ctx = scoreContext(state, now);
    return state.products
        .filter(p => p.visible && p.history.length > 0)
        .map(p => ({ product: p, score: calculateScore(p, ctx) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, AI_MAX_CANDIDATES)
        .map(({ product, score }) => toCandidate(state, product, score));
}

/** Texto enviado ao Gemini: contexto da lista e os candidatos. */
export function buildAiPrompt(state: AppState, now = new Date()): string {
    return JSON.stringify({
        data_de_hoje: toIsoDate(now),
        mes_atual: MONTH_NAMES[now.getMonth()],
        ciclos_ja_impressos: state.totalCycles,
        produtos: buildAiCandidates(state, now),
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
        const { id, quantidade, motivo } = (item ?? {}) as Record<string, unknown>;
        if (!Number.isInteger(id)) return [];
        const quantity = Math.min(AI_MAX_QUANTITY, Math.max(1, Math.round(Number(quantidade)) || 1));
        const reason = typeof motivo === 'string' ? motivo.trim().slice(0, AI_REASON_MAX) : '';
        return [{ productId: id as number, quantity, reason }];
    });
}

/** Liga as escolhas aos produtos do estado atual; ids desconhecidos, ocultos ou repetidos são ignorados. */
export function resolveAiPicks(state: AppState, picks: AiPick[], now = new Date()): RecommendationGroups {
    const ctx = scoreContext(state, now);
    const byId = new Map(state.products.filter(p => p.visible).map(p => [p.id, p]));
    const seen = new Set<number>();
    const recommendations: Recommendation[] = [];

    picks.forEach(pick => {
        const product = byId.get(pick.productId);
        if (!product || seen.has(pick.productId)) return;
        seen.add(pick.productId);
        recommendations.push({
            product,
            score: calculateScore(product, ctx),
            context: pick.reason || describeRecommendation(product, state.totalCycles),
            recommendedQty: pick.quantity,
        });
    });
    return groupRecommendations(recommendations);
}
