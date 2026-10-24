'use client';

import { useState, type FormEvent } from 'react';
import type { Category, ProductInput } from '@/domain/types';
import { Modal } from './Modal';

interface ProductFormModalProps {
    title: string;
    categories: Category[];
    initial?: Partial<ProductInput>;
    /** Retorna uma mensagem de erro para exibir no formulário, se houver. */
    onSubmit: (input: ProductInput) => Promise<string | void> | string | void;
    onClose: () => void;
}

/** Formulário de cadastro e edição de produto (catálogo e importação de ciclo). */
export function ProductFormModal({ title, categories, initial, onSubmit, onClose }: ProductFormModalProps) {
    const [name, setName] = useState(initial?.name ?? '');
    const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
    const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!name.trim() || categoryId === undefined || busy) return;
        setBusy(true);
        try {
            setError((await onSubmit({ name: name.trim(), imageUrl: imageUrl.trim(), categoryId })) || '');
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
                    <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
