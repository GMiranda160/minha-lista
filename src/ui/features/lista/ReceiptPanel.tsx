'use client';

import { Eraser, Printer, Receipt, ShoppingCart, X } from 'lucide-react';
import type { Product } from '@/domain/types';

interface ReceiptPanelProps {
    items: Product[];
    open: boolean;
    onToggleOpen: () => void;
    onRemove: (productId: number) => void;
    onClear: () => void;
    onPrint: () => void;
}

/** "Notinha" com os itens selecionados. Coluna fixa no PC, painel inferior no celular. */
export function ReceiptPanel({ items, open, onToggleOpen, onRemove, onClear, onPrint }: ReceiptPanelProps) {
    const count = items.length;
    return (
        <>
            <button type="button" className="receipt-fab" onClick={onToggleOpen} aria-expanded={open}>
                <Receipt size={18} /> Minha lista <span className="receipt-count">{count}</span>
            </button>
            {open && <div className="backdrop receipt-backdrop" onClick={onToggleOpen} />}
            <aside className={`receipt ${open ? 'open' : ''}`} aria-label="Itens selecionados">
                <header className="receipt-header">
                    <h3><Receipt size={18} /> Minha Lista</h3>
                    <span className="receipt-count">{count}</span>
                    <button type="button" className="icon-btn receipt-close" onClick={onToggleOpen} aria-label="Fechar lista">
                        <X size={18} />
                    </button>
                </header>
                <div className="receipt-body">
                    {count === 0 ? (
                        <div className="receipt-empty"><ShoppingCart size={28} /><p>Nenhum item selecionado</p></div>
                    ) : items.map(p => (
                        <div className="receipt-item" key={p.id}>
                            <span className="receipt-item-name">{p.name}</span>
                            <span className="receipt-item-qty">x{p.quantity}</span>
                            <button type="button" className="icon-btn" onClick={() => onRemove(p.id)} aria-label={`Remover ${p.name}`}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <footer className="receipt-footer">
                    <button type="button" className="btn btn-danger-outline" onClick={onClear} disabled={count === 0}>
                        <Eraser size={16} /> Limpar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={onPrint} disabled={count === 0}>
                        <Printer size={16} /> Imprimir
                    </button>
                </footer>
            </aside>
        </>
    );
}
