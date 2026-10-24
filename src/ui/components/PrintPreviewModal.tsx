'use client';

import { Info, Printer } from 'lucide-react';
import type { ListItem } from '@/domain/types';
import { Modal } from './Modal';

interface PrintPreviewModalProps {
    title: string;
    heading: string;
    items: ListItem[];
    confirmLabel: string;
    onConfirm: () => void;
    onClose: () => void;
}

/** Pré-visualização da lista antes de abrir a impressão no navegador. */
export function PrintPreviewModal({ title, heading, items, confirmLabel, onConfirm, onClose }: PrintPreviewModalProps) {
    return (
        <Modal
            title={title}
            onClose={onClose}
            size="lg"
            footer={
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                    <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={items.length === 0}>
                        <Printer size={16} /> {confirmLabel}
                    </button>
                </>
            }
        >
            <p className="print-preview-heading">{heading}</p>
            <div className="print-preview">
                {items.map(item => (
                    <div className="print-preview-item" key={item.name}>
                        <span className="print-preview-check" />
                        <span className="print-preview-name">{item.name}</span>
                        <strong>{item.quantity}</strong>
                    </div>
                ))}
            </div>
            <p className="hint"><Info size={14} /> A lista abre em uma nova aba e é impressa em A4 paisagem.</p>
        </Modal>
    );
}
