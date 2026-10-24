'use client';

import { useState, type FormEvent } from 'react';
import { validateCategoryName } from '@/domain/categories';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_NAME_MAX } from '@/domain/constants';
import type { AppState, Category, CategoryInput } from '@/domain/types';
import { CategoryIcon } from '@/ui/components/CategoryIcon';
import { Modal } from '@/ui/components/Modal';

interface CategoryFormModalProps {
    state: AppState;
    editing?: Category;
    /** Retorna uma mensagem de erro para exibir no formulário, se houver. */
    onSubmit: (input: CategoryInput) => Promise<string | void> | string | void;
    onClose: () => void;
}

/** Cadastro e edição de categoria: nome, cor e ícone. */
export function CategoryFormModal({ state, editing, onSubmit, onClose }: CategoryFormModalProps) {
    const [name, setName] = useState(editing?.name ?? '');
    const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]);
    const [icon, setIcon] = useState(editing?.icon ?? 'tag');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        const invalid = validateCategoryName(state, name, editing?.id);
        if (invalid) {
            setError(invalid);
            return;
        }
        setBusy(true);
        try {
            setError((await onSubmit({ name: name.trim(), color, icon })) || '');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal title={editing ? 'Editar categoria' : 'Nova categoria'} onClose={onClose} size="sm">
            <form className="form" onSubmit={handleSubmit}>
                <div className="category-preview" style={{ background: `${color}1f`, color }}>
                    <CategoryIcon icon={icon} size={22} />
                    <strong>{name.trim() || 'Nome da categoria'}</strong>
                </div>

                <label className="form-field">
                    <span>Nome</span>
                    <input autoFocus required maxLength={CATEGORY_NAME_MAX} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Hortifrúti" />
                </label>

                <fieldset className="form-field">
                    <legend>Cor</legend>
                    <div className="swatch-grid" role="radiogroup" aria-label="Cor">
                        {CATEGORY_COLORS.map(option => (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={color === option}
                                aria-label={option}
                                className={`swatch ${color === option ? 'active' : ''}`}
                                style={{ background: option }}
                                onClick={() => setColor(option)}
                            />
                        ))}
                    </div>
                </fieldset>

                <fieldset className="form-field">
                    <legend>Ícone</legend>
                    <div className="icon-grid" role="radiogroup" aria-label="Ícone">
                        {CATEGORY_ICONS.map(option => (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={icon === option}
                                aria-label={option}
                                className={`icon-option ${icon === option ? 'active' : ''}`}
                                style={icon === option ? { background: color, borderColor: color } : undefined}
                                onClick={() => setIcon(option)}
                            >
                                <CategoryIcon icon={option} />
                            </button>
                        ))}
                    </div>
                </fieldset>

                {error && <p className="form-error">{error}</p>}
                <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
                        {busy ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
