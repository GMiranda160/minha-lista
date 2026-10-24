/* =================================================================
   Documento de impressão da lista (A4 paisagem).
   ================================================================= */

import type { ListItem } from './types';

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]!));
}

/**
 * Gera uma página HTML autossuficiente que imprime ao abrir.
 * Usa colunas (multicol) em vez de grid porque grid não é fragmentado entre
 * páginas em alguns navegadores e empurrava a lista inteira para a 2ª folha.
 * Antes de imprimir, reduz a fonte (até 10px) e, se preciso, passa para
 * 4 colunas para caber em uma folha.
 */
export function buildPrintDocument(title: string, items: ListItem[]): string {
    const rows = items.map(item => `
        <div class="print-item">
            <div class="print-checkbox"></div>
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-quantity">${item.quantity}</span>
        </div>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minha Lista ${escapeHtml(title)}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 15px; }
        body { width: 277mm; }
        .print-date { font-size: 1.05rem; font-weight: 600; color: #475569; margin-bottom: 0.9rem; }
        .print-list { column-count: 3; column-gap: 2rem; }
        .print-item { display: flex; align-items: flex-start; gap: 0.65rem; padding: 0.4rem 0; border-bottom: 1px dashed #cbd5e1; break-inside: avoid; }
        .print-checkbox { width: 1rem; height: 1rem; border: 1.5px solid #334155; border-radius: 3px; flex-shrink: 0; margin-top: 0.1rem; }
        .item-name { font-weight: 500; flex: 1; }
        .item-quantity { font-weight: 700; color: #0f766e; }
    </style>
</head>
<body>
    <div class="print-date">${escapeHtml(title)}</div>
    <div class="print-list">${rows}</div>
    <script>
        function fitToOnePage() {
            var pageHeightPx = 190 * 96 / 25.4;
            var root = document.documentElement;
            var list = document.querySelector('.print-list');
            var columns = [3, 4];
            for (var c = 0; c < columns.length; c++) {
                list.style.columnCount = columns[c];
                for (var size = 15; size >= 10; size -= 0.5) {
                    root.style.fontSize = size + 'px';
                    if (document.body.scrollHeight <= pageHeightPx) return;
                }
            }
        }
        window.addEventListener('load', function () {
            fitToOnePage();
            window.focus();
            setTimeout(function () { window.print(); }, 300);
        });
    </script>
</body>
</html>`;
}
