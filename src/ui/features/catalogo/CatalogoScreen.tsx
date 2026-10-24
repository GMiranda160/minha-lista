'use client';

import { Eye, EyeOff, Layers, PackageOpen, Pencil, Plus, ShoppingBasket, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PATTERN_TYPE_LABELS } from '@/domain/constants';
import { addProduct, groupCatalog, removeProduct, toggleVisibility, updateProduct } from '@/domain/list';
import type { Product, ProductInput } from '@/domain/types';
import { createProduct } from '@/services/stateActions';
import { CategoryGroups } from '@/ui/components/CategoryGroups';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { EmptyState } from '@/ui/components/EmptyState';
import { PageHeader } from '@/ui/components/PageHeader';
import { ProductFormModal } from '@/ui/components/ProductFormModal';
import { SearchField } from '@/ui/components/SearchField';
import { useAppState, useStore } from '@/ui/store/AppStoreProvider';
import { CategoryManagerModal } from './CategoryManagerModal';

type Editing = { mode: 'new' } | { mode: 'edit'; product: Product } | null;

export function CatalogoScreen() {
    const store = useStore();
    const state = useAppState();
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState<number | 'all'>('all');
    const [editing, setEditing] = useState<Editing>(null);
    const [removing, setRemoving] = useState<Product | null>(null);
    const [managingCategories, setManagingCategories] = useState(false);

    const groups = useMemo(() => groupCatalog(state, search, categoryId), [state, search, categoryId]);
    const shown = groups.reduce((sum, g) => sum + g.products.length, 0);
    const visibleCount = state.products.filter(p => p.visible).length;

    async function saveProduct(input: ProductInput) {
        if (editing?.mode === 'edit') {
            store.apply(s => updateProduct(s, editing.product.id, input));
            setEditing(null);
            return;
        }
        const result = await createProduct(input);
        if (!result.ok) return result.error;
        store.applySaved(s => addProduct(s, result.data));
        setEditing(null);
    }

    return (
        <div className="page">
            <PageHeader
                title="Gerenciar catálogo"
                subtitle={`${state.products.length} produtos no catálogo · ${visibleCount} visíveis na lista`}
                actions={
                    <>
                        <button type="button" className="btn btn-outline" onClick={() => setManagingCategories(true)}>
                            <Layers size={16} /> Categorias
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'new' })}>
                            <Plus size={16} /> Novo produto
                        </button>
                    </>
                }
            />
            <div className="toolbar">
                <SearchField value={search} onChange={setSearch} placeholder="Buscar no catálogo..." />
                <select
                    className="select"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    aria-label="Filtrar por categoria"
                >
                    <option value="all">Todas as categorias</option>
                    {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className="muted">Exibindo {shown}</span>
            </div>

            {groups.length === 0 ? (
                <EmptyState icon={PackageOpen} title="Nenhum produto encontrado.">
                    Cadastre um novo produto ou ajuste a busca.
                </EmptyState>
            ) : (
                <CategoryGroups
                    groups={groups}
                    storageKey="catalogo.categorias-recolhidas"
                    forceOpen={!!search.trim()}
                    gridClassName="catalog-grid"
                    renderProduct={product => (
                        <CatalogCard
                            key={product.id}
                            product={product}
                            onToggleVisibility={() => store.apply(s => toggleVisibility(s, product.id))}
                            onEdit={() => setEditing({ mode: 'edit', product })}
                            onRemove={() => setRemoving(product)}
                        />
                    )}
                />
            )}

            {editing && (
                <ProductFormModal
                    title={editing.mode === 'edit' ? 'Editar produto' : 'Cadastrar novo produto'}
                    categories={state.categories}
                    initial={editing.mode === 'edit' ? editing.product : undefined}
                    onSubmit={saveProduct}
                    onClose={() => setEditing(null)}
                />
            )}
            {removing && (
                <ConfirmDialog
                    title="Confirmar remoção"
                    message={<>Remover permanentemente o produto <strong>{removing.name}</strong> e todo o histórico dele?</>}
                    confirmLabel="Remover"
                    onConfirm={() => { store.apply(s => removeProduct(s, removing.id)); setRemoving(null); }}
                    onCancel={() => setRemoving(null)}
                />
            )}
            {managingCategories && <CategoryManagerModal state={state} onClose={() => setManagingCategories(false)} />}
        </div>
    );
}

interface CatalogCardProps {
    product: Product;
    onToggleVisibility: () => void;
    onEdit: () => void;
    onRemove: () => void;
}

function CatalogCard({ product, onToggleVisibility, onEdit, onRemove }: CatalogCardProps) {
    const pp = product.pattern;
    const meta = [PATTERN_TYPE_LABELS[pp.patternType], `${pp.appearCount}x`]
        .filter(Boolean).join(' · ');

    return (
        <article
            className={`catalog-card ${product.visible ? '' : 'is-hidden'} ${product.imageUrl ? 'has-img' : ''}`}
            style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}
        >
            {!product.imageUrl && <span className="card-placeholder" aria-hidden><ShoppingBasket size={34} /></span>}
            <div className="card-band">
                <span className="card-name" title={product.name}>{product.name}</span>
                <span className="card-meta">{meta}</span>
                <div className="card-actions">
                    <button
                        type="button"
                        className={`icon-btn vis ${product.visible ? 'on' : 'off'}`}
                        onClick={onToggleVisibility}
                        title={product.visible ? 'Ocultar da lista' : 'Mostrar na lista'}
                    >
                        {product.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button type="button" className="icon-btn edit" onClick={onEdit} title="Editar"><Pencil size={16} /></button>
                    <button type="button" className="icon-btn delete" onClick={onRemove} title="Excluir"><Trash size={16} /></button>
                </div>
            </div>
        </article>
    );
}
