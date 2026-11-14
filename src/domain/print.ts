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
 * Gera uma página HTML autossuficiente que imprime ao abrir, em A4 paisagem.
 * Usa colunas (multicol) em vez de grid porque grid não é fragmentado entre
 * páginas em alguns navegadores e empurrava a lista inteira para a 2ª folha.
 * O viewport é fixado na largura da folha (297mm) para que o celular monte a
 * página como paisagem em vez de uma tela estreita. Antes de imprimir, o
 * script testa de 3 a 6 colunas e escolhe a que dá a maior fonte (de 9px a
 * 26px) cabendo em uma folha, desde que nenhuma palavra estoure a coluna e
 * poucos nomes quebrem de linha (senão a lista fica apertada). Checkbox, espaços e quantidade usam
 * rem, então escalam junto com a fonte. A data fica em tamanho fixo (px).
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
    <meta name="viewport" content="width=1123">
    <title>Minha Lista ${escapeHtml(title)}</title>
    <style>
        /* A4 paisagem: a medida explícita reforça a orientação em navegadores móveis.
           Margem 0 na página: cabeçalho e rodapé do navegador (título, data, endereço) ficam
           na margem e deixam de ser impressos. A margem real vem do padding do body. */
        @page { size: A4 landscape; size: 297mm 210mm; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html {
            font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 17px;
            -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-text-size-adjust: 100%; text-size-adjust: 100%;
        }
        body { width: 297mm; padding: 10mm; }
        .print-date { font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 0.8rem; }
        .print-list { column-count: 3; column-gap: 2rem; }
        .print-item { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.4rem 0; border-bottom: 1px dashed #cbd5e1; break-inside: avoid; }
        .print-checkbox { width: 1.15rem; height: 1.15rem; border: 1.75px solid #334155; border-radius: 3px; flex-shrink: 0; margin-top: 0.12rem; }
        .item-name { font-weight: 500; flex: 1; min-width: 0; line-height: 1.25; }
        .item-quantity { font-weight: 700; color: #0f766e; font-size: 1.05em; flex: none; min-width: 3ch; text-align: right; line-height: 1.25; }
    </style>
</head>
<body>
    <div class="print-date">${escapeHtml(title)}</div>
    <div class="print-list">${rows}</div>
    <script>
        /* Mede os nomes: quantos quebram de linha e se alguma palavra estoura a coluna. */
        function measureNames() {
            var names = document.querySelectorAll('.item-name');
            var wrapped = 0;
            var overflow = false;
            for (var i = 0; i < names.length; i++) {
                var lineHeight = parseFloat(getComputedStyle(names[i]).lineHeight);
                if (names[i].offsetHeight > lineHeight * 1.5) wrapped++;
                if (names[i].scrollWidth > names[i].clientWidth + 1) overflow = true;
            }
            return { wrappedShare: names.length ? wrapped / names.length : 0, overflow: overflow };
        }
        /* Maior fonte (px) em que o corpo cabe na altura útil da folha, ou 0 se nem a menor cabe. */
        function largestFittingFont(columns, maxHeightPx) {
            var root = document.documentElement;
            document.querySelector('.print-list').style.columnCount = columns;
            for (var size = 26; size >= 9; size -= 0.25) {
                root.style.fontSize = size + 'px';
                if (document.body.scrollHeight <= maxHeightPx) return size;
            }
            return 0;
        }
        function fitToOnePage() {
            var maxHeightPx = 207 * 96 / 25.4;
            var best = null;
            var fallback = null;
            var loose = null;
            for (var columns = 3; columns <= 6; columns++) {
                var size = largestFittingFont(columns, maxHeightPx);
                if (!size) continue;
                var option = { columns: columns, size: size };
                var measure = measureNames();
                if (!loose || size > loose.size) loose = option;
                if (measure.overflow) continue;
                if (!fallback || size > fallback.size) fallback = option;
                if (measure.wrappedShare <= 0.15 && (!best || size > best.size)) best = option;
            }
            var chosen = best || fallback || loose || { columns: 6, size: 9 };
            document.querySelector('.print-list').style.columnCount = chosen.columns;
            document.documentElement.style.fontSize = chosen.size + 'px';
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
