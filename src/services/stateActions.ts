'use server';

/* =================================================================
   Ações do servidor chamadas pelas telas: carregar, salvar,
   cadastrar produto e restaurar backup.
   ================================================================= */

import { applyChanges, importBackup, insertProduct, loadState } from '@/data/stateRepository';
import { parseBackup } from '@/domain/backup';
import type { Changeset } from '@/domain/changes';
import { isCategory } from '@/domain/constants';
import type { AppState, Product, ProductInput } from '@/domain/types';
import { runAction, type ActionResult } from './result';
import { requireUserDb } from './session';

export async function fetchState(): Promise<ActionResult<AppState>> {
    return runAction(async () => loadState((await requireUserDb()).db));
}

export async function saveChanges(changes: Changeset): Promise<ActionResult> {
    return runAction(async () => applyChanges((await requireUserDb()).db, changes));
}

export async function createProduct(input: ProductInput): Promise<ActionResult<Product>> {
    return runAction(async () => {
        const name = input.name?.trim();
        if (!name) throw new Error('Informe o nome do produto.');
        const category = isCategory(input.category) ? input.category : 'outros';
        const { db } = await requireUserDb();
        return insertProduct(db, { name, imageUrl: input.imageUrl?.trim() ?? '', category });
    });
}

/** Substitui todos os dados do usuário pelo conteúdo do arquivo de backup. */
export async function restoreBackup(raw: unknown): Promise<ActionResult<AppState>> {
    return runAction(async () => {
        const backup = parseBackup(raw);
        if (!backup) throw new Error('Formato de arquivo inválido.');
        const { db } = await requireUserDb();
        await importBackup(db, backup);
        return loadState(db);
    });
}
