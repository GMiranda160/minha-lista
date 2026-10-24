'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
    title: ReactNode;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

/** Janela modal acessível (fecha com Esc ou clicando fora). Vira painel inferior no celular. */
export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className={`modal modal-${size}`}
            onCancel={event => { event.preventDefault(); onClose(); }}
            onClick={event => { if (event.target === dialogRef.current) onClose(); }}
        >
            <div className="modal-content">
                <header className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
                        <X size={20} />
                    </button>
                </header>
                <div className="modal-body">{children}</div>
                {footer && <footer className="modal-footer">{footer}</footer>}
            </div>
        </dialog>
    );
}
