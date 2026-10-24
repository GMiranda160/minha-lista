'use server';

/* =================================================================
   Ações do servidor chamadas pelas telas: carregar, salvar,
   cadastrar produto ou categoria e restaurar backup.
   ================================================================= */

import { applyChanges, importBackup, insertCategory, insertProduct, loadState } from '@/data/stateRepository';
import { parseBackup } from '@/domain/backup';
import type { Changeset } from '@/domain/changes';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_NAME_MAX } from '@/domain/constants';
import type { AppState, Category, CategoryInput, Product, ProductInput } from '@/domain/types';
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
        if (!Number.isInteger(input.categoryId)) throw new Error('Escolha uma categoria.');
        const { db } = await requireUserDb();
        return insertProduct(db, { name, imageUrl: input.imageUrl?.trim() ?? '', categoryId: input.categoryId });
    });
}

/** O nome repetido é barrado pelo banco (índice único por usuário). */
export async function createCategory(input: CategoryInput & { position: number }): Promise<ActionResult<Category>> {
    return runAction(async () => {
        const name = input.name?.trim();
        if (!name || name.length > CATEGORY_NAME_MAX) throw new Error(`Informe um nome de até ${CATEGORY_NAME_MAX} caracteres.`);
        const { db } = await requireUserDb();
        return insertCategory(db, {
            name,
            color: CATEGORY_COLORS.includes(input.color) ? input.color : CATEGORY_COLORS[0],
            icon: (CATEGORY_ICONS as readonly string[]).includes(input.icon) ? input.icon : 'tag',
            position: Number.isInteger(input.position) ? input.position : 0,
        });
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
