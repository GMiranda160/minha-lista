'use client';

import { CirclePlus, FileUp, Trash } from 'lucide-react';
import { useState } from 'react';
import { parseCycleExport, type CycleFile, type CycleFileItem } from '@/domain/backup';
import { findCategory, resolveCategoryId } from '@/domain/categories';
import { importCycle } from '@/domain/cycles';
import { addProduct } from '@/domain/list';
import { formatDate, sameName } from '@/domain/text';
import { createProduct } from '@/services/stateActions';
import { Modal } from '@/ui/components/Modal';
import { ProductFormModal } from '@/ui/components/ProductFormModal';
import { readJsonFile } from '@/ui/lib/files';
import { useAppState, useStore } from '@/ui/store/AppStoreProvider';

interface Session {
    date: string;
    queue: CycleFileItem[];
    resolved: { productId: number; quantity: number }[];
    current: CycleFileItem | null;
    registering: boolean;
}

/**
 * Importa um ciclo exportado em .json. Itens cujo produto não existe no
 * catálogo são perguntados um a um: cadastrar ou descartar. Nada é gravado
 * até o fim; cancelar aborta tudo.
 */
export function useCycleImport() {
    const store = useStore();
    const [session, setSession] = useState<Session | null>(null);
    const [error, setError] = useState('');

    function advance(next: Session) {
        const queue = [...next.queue];
        const resolved = [...next.resolved];
        while (queue.length > 0) {
            const item = queue.shift()!;
            const product = store.getState().products.find(p => sameName(p.name, item.productName));
            if (!product) {
                setSession({ ...next, queue, resolved, current: item, registering: false });
                return;
            }
            resolved.push({ productId: product.id, quantity: item.quantity });
        }
        setSession(null);
        if (resolved.length > 0) store.apply(s => importCycle(s, next.date, resolved));
    }

    async function startImport(file: File) {
        setError('');
        const cycle: CycleFile | null = parseCycleExport(await readJsonFile(file));
        if (!cycle) {
            setError('Arquivo de ciclo inválido.');
            return;
        }
        advance({ date: cycle.date, queue: cycle.items, resolved: [], current: null, registering: false });
    }

    async function registerCurrent(input: Parameters<typeof createProduct>[0]) {
        if (!session?.current) return;
        const result = await createProduct(input);
        if (!result.ok) return result.error;
        store.applySaved(s => addProduct(s, result.data));
        advance({
            ...session,
            current: null,
            resolved: [...session.resolved, { productId: result.data.id, quantity: session.current.quantity }],
        });
    }

    const current = session?.current;
    const state = useAppState();
    const suggestedCategoryId = current ? resolveCategoryId(state, current.category) : undefined;
    const dialog = current && (session.registering ? (
        <ProductFormModal
            title="Cadastrar produto do ciclo"
            categories={state.categories}
            initial={{ name: current.productName, categoryId: suggestedCategoryId }}
            onSubmit={registerCurrent}
            onClose={() => setSession({ ...session, registering: false })}
        />
    ) : (
        <Modal
            title={<><FileUp size={18} /> Produto não encontrado</>}
            onClose={() => setSession(null)}
            size="sm"
            footer={
                <>
                    <button type="button" className="btn btn-ghost" onClick={() => advance({ ...session, current: null })}>
                        <Trash size={16} /> Descartar item
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setSession({ ...session, registering: true })}>
                        <CirclePlus size={16} /> Cadastrar produto
                    </button>
                </>
            }
        >
            <p>Este item do ciclo importado não existe no catálogo. O que deseja fazer?</p>
            <div className="import-item">
                <strong>{current.productName}</strong>
                <span>{findCategory(state, suggestedCategoryId ?? -1)?.name ?? current.category} · Qtd: {current.quantity} · Data: {formatDate(session.date)}</span>
            </div>
            <p className="hint">Fechar esta janela cancela a importação inteira.</p>
        </Modal>
    ));

    return { startImport, dialog, error };
}
