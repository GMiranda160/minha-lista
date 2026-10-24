'use client';

import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
    title: string;
    message: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
    return (
        <Modal
            title={title}
            onClose={onCancel}
            size="sm"
            footer={
                <>
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
                    <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
                </>
            }
        >
            <p>{message}</p>
        </Modal>
    );
}
