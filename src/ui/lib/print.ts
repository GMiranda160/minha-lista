import { buildPrintDocument } from '@/domain/print';
import type { ListItem } from '@/domain/types';

/**
 * Abre a lista em uma nova aba, que dispara a impressão sozinha.
 * Deve ser chamada direto no clique do usuário para não ser bloqueada como pop-up.
 */
export function openPrintWindow(title: string, items: ListItem[]): boolean {
    const html = buildPrintDocument(title, items);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const opened = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return opened !== null;
}
