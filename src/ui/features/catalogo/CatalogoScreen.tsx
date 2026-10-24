'use client';

import { Eye, EyeOff, PackageOpen, Pencil, Plus, ShoppingBasket, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORIES, CATEGORY_KEYS, PATTERN_TYPE_LABELS } from '@/domain/constants';
import { filterCatalog, removeProduct, toggleVisibility, updateProduct } from '@/domain/list';
import type { Category, Product, ProductInput } from '@/domain/types';
import { createProduct } from '@/services/stateActions';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { EmptyState } from '@/ui/components/EmptyState';
import { PageHeader } from '@/ui/components/PageHeader';
import { ProductFormModal } from '@/ui/components/ProductFormModal';
import { SearchField } from '@/ui/components/SearchField';
import { useAppState, useStore } from '@/ui/store/AppStoreProvider';

type Editing = { mode: 'new' } | { mode: 'edit'; product: Product } | null;

export function CatalogoScreen() {
    const store = useStore();
    const state = useAppState();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<Category | 'all'>('all');
    const [editing, setEditing] = useState<Editing>(null);
    const [removing, setRemoving] = useState<Product | null>(null);

    const products = useMemo(() => filterCatalog(state, search, category), [state, search, category]);
    const visibleCount = state.products.filter(p => p.visible).length;

    async function saveProduct(input: ProductInput) {
        if (editing?.mode === 'edit') {
            store.apply(s => updateProduct(s, editing.product.id, input));
            setEditing(null);
            return;
        }
        const result = await createProduct(input);
        if (!result.ok) return result.error;
        store.addSavedProduct(result.data);
        setEditing(null);
    }

    return (
        <div className="page">
            <PageHeader
                title="Gerenciar catálogo"
                subtitle={`${state.products.length} produtos no catálogo · ${visibleCount} visíveis na lista`}
                actions={
                    <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'new' })}>
                        <Plus size={16} /> Novo produto
                    </button>
                }
            />
            <div className="toolbar">
                <SearchField value={search} onChange={setSearch} placeholder="Buscar no catálogo..." />
                <select className="select" value={category} onChange={e => setCategory(e.target.value as Category | 'all')} aria-label="Filtrar por categoria">
                    <option value="all">Todas as categorias</option>
                    {CATEGORY_KEYS.map(key => <option key={key} value={key}>{CATEGORIES[key]}</option>)}
                </select>
                <span className="muted">Exibindo {products.length}</span>
            </div>

            {products.length === 0 ? (
                <EmptyState icon={PackageOpen} title="Nenhum produto encontrado.">
                    Cadastre um novo produto ou ajuste a busca.
                </EmptyState>
            ) : (
                <div className="catalog-grid">
                    {products.map(product => (
                        <CatalogCard
                            key={product.id}
                            product={product}
                            onToggleVisibility={() => store.apply(s => toggleVisibility(s, product.id))}
                            onEdit={() => setEditing({ mode: 'edit', product })}
                            onRemove={() => setRemoving(product)}
                        />
                    ))}
                </div>
            )}

            {editing && (
                <ProductFormModal
                    title={editing.mode === 'edit' ? 'Editar produto' : 'Cadastrar novo produto'}
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
    const meta = [CATEGORIES[product.category], PATTERN_TYPE_LABELS[pp.patternType], `${pp.appearCount}x`]
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
