'use client';

import { useState, type FormEvent } from 'react';
import { CATEGORIES, CATEGORY_KEYS } from '@/domain/constants';
import type { ProductInput } from '@/domain/types';
import { Modal } from './Modal';

interface ProductFormModalProps {
    title: string;
    initial?: Partial<ProductInput>;
    /** Retorna uma mensagem de erro para exibir no formulário, se houver. */
    onSubmit: (input: ProductInput) => Promise<string | void> | string | void;
    onClose: () => void;
}

/** Formulário de cadastro e edição de produto (catálogo e importação de ciclo). */
export function ProductFormModal({ title, initial, onSubmit, onClose }: ProductFormModalProps) {
    const [name, setName] = useState(initial?.name ?? '');
    const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
    const [category, setCategory] = useState(initial?.category ?? 'geladeira');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        try {
            setError((await onSubmit({ name: name.trim(), imageUrl: imageUrl.trim(), category })) || '');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal title={title} onClose={onClose} size="sm">
            <form className="form" onSubmit={handleSubmit}>
                <label className="form-field">
                    <span>Nome do produto</span>
                    <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Arroz, Sabão em pó" />
                </label>
                <label className="form-field">
                    <span>Foto do produto (link)</span>
                    <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
                </label>
                <label className="form-field">
                    <span>Categoria</span>
                    <select value={category} onChange={e => setCategory(e.target.value as ProductInput['category'])}>
                        {CATEGORY_KEYS.map(key => <option key={key} value={key}>{CATEGORIES[key]}</option>)}
                    </select>
                </label>
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
