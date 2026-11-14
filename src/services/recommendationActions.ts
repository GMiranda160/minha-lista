'use server';

/* =================================================================
   Recomendação com IA. Só é chamada quando a pessoa clica no botão.
   Os dados vêm do banco (não do navegador) e a chave fica no servidor.
   ================================================================= */

import { loadState } from '@/data/stateRepository';
import { AI_INSTRUCTIONS, AI_RESPONSE_SCHEMA, buildAiPrompt, parseAiPicks, type AiPick } from '@/domain/recommendationAi';
import { hasEnoughData } from '@/domain/recommendations';
import { generateJson } from './gemini';
import { runAction, type ActionResult } from './result';
import { requireUserDb } from './session';

export async function requestAiRecommendations(): Promise<ActionResult<AiPick[]>> {
    return runAction(async () => {
        const { db } = await requireUserDb();
        const state = await loadState(db);
        if (!hasEnoughData(state)) throw new Error('Ainda não há listas suficientes para recomendar.');
        const text = await generateJson(AI_INSTRUCTIONS, buildAiPrompt(state), AI_RESPONSE_SCHEMA);
        return parseAiPicks(text);
    });
}
