'use client';

import { Download, FileText, Plus, Printer, Save, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { categoryOf } from '@/domain/categories';
import { addCycleItem, removeCycleItem, setCycleQuantities } from '@/domain/cycles';
import { compareNames, formatDate } from '@/domain/text';
import type { AppState, Cycle } from '@/domain/types';
import { CategoryTag } from '@/ui/components/CategoryTag';
import { useStore } from '@/ui/store/AppStoreProvider';

interface CycleDetailProps {
    state: AppState;
    cycle: Cycle;
    onPrint: () => void;
    onExport: () => void;
    onDelete: () => void;
    onClose: () => void;
}

/** Itens de um ciclo: editar quantidades, remover e adicionar produtos. */
export function CycleDetail({ state, cycle, onPrint, onExport, onDelete, onClose }: CycleDetailProps) {
    const store = useStore();
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [newProductId, setNewProductId] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);

    const available = state.products
        .filter(p => !cycle.items.some(i => i.productId === p.id))
        .sort((a, b) => compareNames(a.name, b.name));

    function addItem() {
        if (!newProductId) return;
        store.apply(s => addCycleItem(s, cycle.number, Number(newProductId), newQuantity));
        setNewProductId('');
        setNewQuantity(1);
    }

    function saveQuantities() {
        store.apply(s => setCycleQuantities(s, cycle.number, quantities));
        setQuantities({});
    }

    return (
        <section className="cycle-detail">
            <header className="cycle-detail-header">
                <h3><FileText size={18} /> Ciclo #{cycle.number}: {formatDate(cycle.date)}</h3>
                <div className="cycle-detail-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={onPrint}><Printer size={14} /> Imprimir</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={onExport}><Download size={14} /> Exportar</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}><Trash size={14} /> Excluir</button>
                </div>
            </header>

            <div className="table-wrap">
                <table className="table">
                    <thead><tr><th>Produto</th><th className="qty-col">Quantidade</th><th className="icon-col" /></tr></thead>
                    <tbody>
                        {cycle.items.map(item => (
                            <tr key={item.productId}>
                                <td>
                                    <div className="strong">{item.productName}</div>
                                    <div className="muted small">
                                        <CategoryTag category={categoryOf(state, item)} />
                                    </div>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min={1}
                                        className="input-sm"
                                        value={quantities[item.productId] ?? item.quantity}
                                        onChange={e => setQuantities(q => ({ ...q, [item.productId]: Number(e.target.value) }))}
                                        aria-label={`Quantidade de ${item.productName}`}
                                    />
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="icon-btn delete"
                                        onClick={() => store.apply(s => removeCycleItem(s, cycle.number, item.productId))}
                                        aria-label={`Remover ${item.productName}`}
                                    >
                                        <X size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="cycle-add">
                <span className="muted">Adicionar item:</span>
                <select className="select" value={newProductId} onChange={e => setNewProductId(e.target.value)} aria-label="Produto">
                    <option value="">Selecione um produto</option>
                    {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                    type="number"
                    min={1}
                    className="input-sm"
                    value={newQuantity}
                    onChange={e => setNewQuantity(Math.max(1, Number(e.target.value) || 1))}
                    aria-label="Quantidade"
                />
                <button type="button" className="btn btn-success btn-sm" onClick={addItem} disabled={!newProductId}>
                    <Plus size={14} /> Adicionar
                </button>
            </div>

            <footer className="cycle-detail-footer">
                <button type="button" className="btn btn-primary" onClick={saveQuantities} disabled={Object.keys(quantities).length === 0}>
                    <Save size={16} /> Salvar alterações
                </button>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
            </footer>
        </section>
    );
}
