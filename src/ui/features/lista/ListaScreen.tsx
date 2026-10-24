'use client';

import { ArrowDownAZ, ArrowUpZA, ChartColumn, PackageOpen, WandSparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { registerList } from '@/domain/cycles';
import {
    changeSort, clearSelection, groupVisibleProducts, selectedListItems, selectedProducts, setQuantity, toggleSelection,
} from '@/domain/list';
import { applyRecommendations, recommendedIds } from '@/domain/recommendations';
import { formatDate, plural, toIsoDate } from '@/domain/text';
import { CategoryGroups } from '@/ui/components/CategoryGroups';
import { EmptyState } from '@/ui/components/EmptyState';
import { PageHeader } from '@/ui/components/PageHeader';
import { PrintPreviewModal } from '@/ui/components/PrintPreviewModal';
import { SearchField } from '@/ui/components/SearchField';
import { openPrintWindow } from '@/ui/lib/print';
import { useAppState, useStore } from '@/ui/store/AppStoreProvider';
import { ProductCard } from './ProductCard';
import { ReceiptPanel } from './ReceiptPanel';
import { RecommendationModal } from './RecommendationModal';

type Dialog = 'none' | 'recommendations' | 'print';

export function ListaScreen() {
    const store = useStore();
    const state = useAppState();
    const [search, setSearch] = useState('');
    const [dialog, setDialog] = useState<Dialog>('none');
    const [receiptOpen, setReceiptOpen] = useState(false);

    const groups = useMemo(() => groupVisibleProducts(state, search), [state, search]);
    const recommended = useMemo(() => recommendedIds(state), [state]);
    const selected = useMemo(() => selectedProducts(state), [state]);

    const toggle = useCallback((id: number) => store.apply(s => toggleSelection(s, id)), [store]);
    const changeQuantity = useCallback((id: number, q: number) => store.apply(s => setQuantity(s, id, q)), [store]);

    function confirmPrint() {
        const items = selectedListItems(state);
        const now = new Date();
        openPrintWindow(formatDate(toIsoDate(now)), items);
        store.apply(s => registerList(s, now));
        setDialog('none');
        setReceiptOpen(false);
    }

    const subtitle = state.totalCycles > 0
        ? `Ciclo #${state.totalCycles} · ${selected.length} ${plural(selected.length, 'selecionado')}`
        : `${state.products.filter(p => p.visible).length} produtos na lista`;

    const isAlpha = state.sortMode === 'alpha';

    return (
        <div className="lista-page">
            <section className="lista-main">
                <PageHeader title="Minha Lista" subtitle={subtitle} />
                <div className="toolbar">
                    <SearchField value={search} onChange={setSearch} placeholder="Pesquisar produto..." />
                    <div className="toolbar-group">
                        <button
                            type="button"
                            className={`tool-btn ${isAlpha ? 'active' : ''}`}
                            onClick={() => store.apply(s => changeSort(s, 'alpha'))}
                            title="Ordenar de A a Z"
                        >
                            {isAlpha && state.sortDirection === 'desc' ? <ArrowUpZA size={18} /> : <ArrowDownAZ size={18} />}
                        </button>
                        <button
                            type="button"
                            className={`tool-btn ${!isAlpha ? 'active' : ''}`}
                            onClick={() => store.apply(s => changeSort(s, 'frequency'))}
                            title="Priorizar itens comprados com mais frequência"
                        >
                            <ChartColumn size={18} />
                        </button>
                        <button type="button" className="tool-btn rec" onClick={() => setDialog('recommendations')} title="Ver recomendações">
                            <WandSparkles size={18} /> <span className="hide-sm">Recomendações</span>
                        </button>
                    </div>
                </div>

                {groups.length === 0 ? (
                    <EmptyState icon={PackageOpen} title="Nenhum produto encontrado.">
                        Limpe a pesquisa ou cadastre um novo produto no catálogo.
                    </EmptyState>
                ) : (
                    <CategoryGroups
                        groups={groups}
                        storageKey="lista.categorias-recolhidas"
                        forceOpen={!!search.trim()}
                        gridClassName="product-grid"
                        renderProduct={product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                showFrequency={!isAlpha}
                                recommended={recommended.has(product.id)}
                                recent={product.pattern.lastPurchaseListIndex > 0 && product.pattern.lastPurchaseListIndex === state.totalCycles}
                                onToggle={toggle}
                                onQuantity={changeQuantity}
                            />
                        )}
                    />
                )}
            </section>

            <ReceiptPanel
                items={selected}
                open={receiptOpen}
                onToggleOpen={() => setReceiptOpen(o => !o)}
                onRemove={id => store.apply(s => setQuantity(s, id, 0))}
                onClear={() => store.apply(clearSelection)}
                onPrint={() => setDialog('print')}
            />

            {dialog === 'recommendations' && (
                <RecommendationModal
                    state={state}
                    onApply={scope => { store.apply(s => applyRecommendations(s, scope)); setDialog('none'); }}
                    onClose={() => setDialog('none')}
                />
            )}
            {dialog === 'print' && (
                <PrintPreviewModal
                    title="Lista de compras"
                    heading={formatDate(toIsoDate(new Date()))}
                    items={selectedListItems(state)}
                    confirmLabel="Confirmar e imprimir"
                    onConfirm={confirmPrint}
                    onClose={() => setDialog('none')}
                />
            )}
        </div>
    );
}
