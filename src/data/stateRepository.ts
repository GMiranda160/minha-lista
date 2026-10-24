/* =================================================================
   Repositório: único ponto que lê e grava as tabelas do usuário.
   ================================================================= */

import 'server-only';
import type { Backup } from '@/domain/backup';
import type { AppState, Product, ProductInput } from '@/domain/types';
import type { Changeset } from '@/domain/changes';
import {
    fromProductRow, toAppState, toBackupPayload, toChangesPayload,
    type ProductRow, type PurchaseRow, type SettingsRow,
} from './mappers';
import type { SupabaseServerClient } from './supabase/server';

const PRODUCT_COLUMNS = 'id, name, image_url, category, visible, selected, quantity, pattern';

function check<T>(result: { data: T; error: { message: string } | null }, action: string): T {
    if (result.error) throw new Error(`Falha ao ${action}: ${result.error.message}`);
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
    const [products, purchases, settings] = await Promise.all([
        selectAll<ProductRow>(
            (from, to) => db.from('products').select(PRODUCT_COLUMNS).order('id').range(from, to),
            'carregar produtos'),
        selectAll<PurchaseRow>(
            (from, to) => db.from('purchases').select('product_id, cycle, date, quantity')
                .order('product_id').order('cycle').range(from, to),
            'carregar compras'),
        db.from('user_settings').select('total_cycles, last_decay_check, sort_mode, sort_direction').maybeSingle(),
    ]);
    return toAppState(products, purchases, check(settings, 'carregar preferências') as SettingsRow | null);
}

export async function insertProduct(db: SupabaseServerClient, input: ProductInput): Promise<Product> {
    const result = await db
        .from('products')
        .insert({ name: input.name, image_url: input.imageUrl, category: input.category })
        .select(PRODUCT_COLUMNS)
        .single();
    return fromProductRow(check(result, 'cadastrar produto') as ProductRow);
}

export async function applyChanges(db: SupabaseServerClient, changes: Changeset): Promise<void> {
    check(await db.rpc('apply_changes', { p_changes: toChangesPayload(changes) }), 'salvar alterações');
}

export async function importBackup(db: SupabaseServerClient, backup: Omit<Backup, 'app' | 'schemaVersion' | 'exportDate'>) {
    check(await db.rpc('import_backup', {
        p_products: toBackupPayload(backup),
        p_total_cycles: backup.totalCycles,
        p_last_decay_check: backup.lastDecayCheck,
    }), 'restaurar backup');
}
