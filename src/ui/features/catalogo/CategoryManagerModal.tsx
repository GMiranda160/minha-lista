'use client';

import { Pencil, Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { addCategory, countProducts, nextPosition, removeCategory, updateCategory } from '@/domain/categories';
import { plural } from '@/domain/text';
import type { AppState, Category, CategoryInput } from '@/domain/types';
import { createCategory } from '@/services/stateActions';
import { CategoryIcon } from '@/ui/components/CategoryIcon';
import { Modal } from '@/ui/components/Modal';
import { useStore } from '@/ui/store/AppStoreProvider';
import { CategoryFormModal } from './CategoryFormModal';

type Editing = { mode: 'new' } | { mode: 'edit'; category: Category } | null;

/** Lista das categorias com cadastrar, editar e remover. */
export function CategoryManagerModal({ state, onClose }: { state: AppState; onClose: () => void }) {
    const store = useStore();
    const [editing, setEditing] = useState<Editing>(null);
    const [removing, setRemoving] = useState<Category | null>(null);

    async function save(input: CategoryInput) {
        if (editing?.mode === 'edit') {
            store.apply(s => updateCategory(s, editing.category.id, input));
            setEditing(null);
            return;
        }
        const result = await createCategory({ ...input, position: nextPosition(store.getState()) });
        if (!result.ok) return result.error;
        store.applySaved(s => addCategory(s, result.data));
        setEditing(null);
    }

    return (
        <Modal
            title="Categorias"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                    <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'new' })}>
                        <Plus size={16} /> Nova categoria
                    </button>
                </>
            }
        >
            <ul className="category-list">
                {state.categories.map(category => {
                    const count = countProducts(state, category.id);
                    return (
                        <li key={category.id} className="category-row">
                            <span className="category-row-icon" style={{ background: `${category.color}1f`, color: category.color }}>
                                <CategoryIcon icon={category.icon} />
                            </span>
                            <span className="category-row-info">
                                <strong>{category.name}</strong>
                                <span className="muted small">{count} {plural(count, 'produto')}</span>
                            </span>
                            <button type="button" className="icon-btn edit" title="Editar" onClick={() => setEditing({ mode: 'edit', category })}>
                                <Pencil size={16} />
                            </button>
                            <button
                                type="button"
                                className="icon-btn delete"
                                title={state.categories.length <= 1 ? 'Precisa existir pelo menos uma categoria' : 'Remover'}
                                disabled={state.categories.length <= 1}
                                onClick={() => setRemoving(category)}
                            >
                                <Trash size={16} />
                            </button>
                        </li>
                    );
                })}
            </ul>

            {editing && (
                <CategoryFormModal
                    state={state}
                    editing={editing.mode === 'edit' ? editing.category : undefined}
                    onSubmit={save}
                    onClose={() => setEditing(null)}
                />
            )}
            {removing && (
                <RemoveCategoryDialog
                    state={state}
                    category={removing}
                    onConfirm={moveToId => { store.apply(s => removeCategory(s, removing.id, moveToId)); setRemoving(null); }}
                    onCancel={() => setRemoving(null)}
                />
            )}
        </Modal>
    );
}

interface RemoveCategoryDialogProps {
    state: AppState;
    category: Category;
    onConfirm: (moveToId?: number) => void;
    onCancel: () => void;
}

/** Confirmação de remoção. Se a categoria tem produtos, pede para onde movê-los. */
function RemoveCategoryDialog({ state, category, onConfirm, onCancel }: RemoveCategoryDialogProps) {
    const count = countProducts(state, category.id);
    const others = state.categories.filter(c => c.id !== category.id);
    const [moveToId, setMoveToId] = useState(others[0]?.id);

    return (
        <Modal
            title="Remover categoria"
            onClose={onCancel}
            size="sm"
            footer={
                <>
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
                    <button type="button" className="btn btn-danger" onClick={() => onConfirm(count > 0 ? moveToId : undefined)}>
                        Remover
                    </button>
                </>
            }
        >
            {count === 0 ? (
                <p>Remover a categoria <strong>{category.name}</strong>?</p>
            ) : (
                <div className="form">
                    <p>
                        A categoria <strong>{category.name}</strong> tem {count} {plural(count, 'produto')}.
                        Para onde {count === 1 ? 'ele deve ir' : 'eles devem ir'}?
                    </p>
                    <label className="form-field">
                        <span>Mover produtos para</span>
                        <select value={moveToId} onChange={e => setMoveToId(Number(e.target.value))}>
                            {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                </div>
            )}
        </Modal>
    );
}
