/* =================================================================
   Repositório: único ponto que lê e grava as tabelas do usuário.
   ================================================================= */

import 'server-only';
import type { BackupContent } from '@/domain/backup';
import type { Changeset } from '@/domain/changes';
import type { AppState, Category, CategoryInput, Product, ProductInput } from '@/domain/types';
import {
    fromProductRow, toAppState, toBackupPayload, toChangesPayload,
    type CategoryRow, type ProductRow, type PurchaseRow, type SettingsRow,
} from './mappers';
import type { SupabaseServerClient } from './supabase/server';

const PRODUCT_COLUMNS = 'id, name, image_url, category_id, visible, selected, quantity, pattern';
const CATEGORY_COLUMNS = 'id, name, color, icon, position';

/** Códigos de erro do PostgreSQL com mensagem amigável. */
const DB_ERRORS: Record<string, string> = {
    '23505': 'Já existe uma categoria com esse nome.',
    '23503': 'Esta categoria ainda tem produtos.',
};

function check<T>(result: { data: T; error: { message: string; code?: string } | null }, action: string): T {
    const { error } = result;
    if (error) throw new Error((error.code && DB_ERRORS[error.code]) || `Falha ao ${action}: ${error.message}`);
    return result.data;
}

/** O Supabase limita cada consulta a 1000 linhas; lê página por página. */
const PAGE_SIZE = 1000;

async function selectAll<T>(
    query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    action: string,
): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const page = check(await query(from, from + PAGE_SIZE - 1), action) ?? [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
    }
}

export async function loadState(db: SupabaseServerClient): Promise<AppState> {
    const [categories, products, purchases, settings] = await Promise.all([
        db.from('categories').select(CATEGORY_COLUMNS).order('position').order('id'),
        selectAll<ProductRow>(
            (from, to) => db.from('products').select(PRODUCT_COLUMNS).order('id').range(from, to),
            'carregar produtos'),
        selectAll<PurchaseRow>(
            (from, to) => db.from('purchases').select('product_id, cycle, date, quantity')
                .order('product_id').order('cycle').range(from, to),
            'carregar compras'),
        db.from('user_settings').select('total_cycles, last_decay_check, sort_mode, sort_direction').maybeSingle(),
    ]);
    return toAppState(
        check(categories, 'carregar categorias') as CategoryRow[],
        products,
        purchases,
        check(settings, 'carregar preferências') as SettingsRow | null,
    );
}

export async function insertProduct(db: SupabaseServerClient, input: ProductInput): Promise<Product> {
    const result = await db
        .from('products')
        .insert({ name: input.name, image_url: input.imageUrl, category_id: input.categoryId })
        .select(PRODUCT_COLUMNS)
        .single();
    return fromProductRow(check(result, 'cadastrar produto') as ProductRow);
}

export async function insertCategory(db: SupabaseServerClient, input: CategoryInput & { position: number }): Promise<Category> {
    const result = await db.from('categories').insert(input).select(CATEGORY_COLUMNS).single();
    return check(result, 'cadastrar categoria') as CategoryRow;
}

export async function applyChanges(db: SupabaseServerClient, changes: Changeset): Promise<void> {
    check(await db.rpc('apply_changes', { p_changes: toChangesPayload(changes) }), 'salvar alterações');
}

export async function importBackup(db: SupabaseServerClient, backup: BackupContent) {
    check(await db.rpc('import_backup', {
        ...toBackupPayload(backup),
        p_total_cycles: backup.totalCycles,
        p_last_decay_check: backup.lastDecayCheck,
    }), 'restaurar backup');
}
