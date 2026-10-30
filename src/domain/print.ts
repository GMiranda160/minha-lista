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
 * Antes de imprimir, reduz a fonte (até 11px) e, se preciso, passa para
 * 4 ou 5 colunas para caber em uma folha. A data fica em tamanho fixo (px),
 * fora do ajuste automático, para não crescer junto com os itens.
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
        /* A4 paisagem: a medida explícita reforça a orientação em navegadores móveis. */
        @page { size: A4 landscape; size: 297mm 210mm; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html {
            font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 17px;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        body { width: 277mm; }
        .print-date { font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 0.8rem; }
        .print-list { column-count: 3; column-gap: 2rem; }
        .print-item { display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.45rem 0; border-bottom: 1px dashed #cbd5e1; break-inside: avoid; }
        .print-checkbox { width: 1.15rem; height: 1.15rem; border: 1.75px solid #334155; border-radius: 3px; flex-shrink: 0; margin-top: 0.12rem; }
        .item-name { font-weight: 500; flex: 1; line-height: 1.3; }
        .item-quantity { font-weight: 700; color: #0f766e; font-size: 1.05em; }
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
            var columns = [3, 4, 5];
            for (var c = 0; c < columns.length; c++) {
                list.style.columnCount = columns[c];
                for (var size = 17; size >= 11; size -= 0.5) {
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
