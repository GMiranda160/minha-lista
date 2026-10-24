import { describe, expect, it } from 'vitest';
import { parseBackup, parseCycleExport } from '@/domain/backup';
import { diffState } from '@/domain/changes';
import { deleteCycle, getAllCycles, registerList } from '@/domain/cycles';
import { clearSelection, groupVisibleProducts, setQuantity, toggleSelection } from '@/domain/list';
import { cycleLabel, createDefaultPattern } from '@/domain/pattern';
import { buildPrintDocument } from '@/domain/print';
import { generateRecommendations } from '@/domain/recommendations';
import { normalizeProduct } from '@/domain/state';
import type { AppState, Product } from '@/domain/types';

const NOW = new Date(2026, 9, 24);

function product(id: number, name: string, extra: Partial<Product> = {}): Product {
    return normalizeProduct({ id, name, category: 'armarios', ...extra });
}

function state(products: Product[], totalCycles = 0): AppState {
    return { products, totalCycles, lastDecayCheck: 0, sortMode: 'alpha', sortDirection: 'asc' };
}

/** Simula N listas em que "Arroz" é comprado sempre e "Café" a cada duas. */
function simulate(lists: number): AppState {
    let s = state([product(1, 'Arroz'), product(2, 'Café'), product(3, 'Sabão', { category: 'limpeza' })]);
    for (let i = 1; i <= lists; i++) {
        s = setQuantity(s, 1, 2);
        if (i % 2 === 0) s = toggleSelection(s, 2);
        s = registerList(s, new Date(2026, 0, i * 7));
    }
    return s;
}

describe('lista', () => {
    it('seleciona, altera quantidade e remove quando chega a zero', () => {
        let s = state([product(1, 'Arroz')]);
        s = toggleSelection(s, 1);
        expect(s.products[0]).toMatchObject({ selected: true, quantity: 1 });
        s = setQuantity(s, 1, 4);
        expect(s.products[0].quantity).toBe(4);
        s = setQuantity(s, 1, 0);
        expect(s.products[0]).toMatchObject({ selected: false, quantity: 1 });
    });

    it('agrupa por categoria, ignora acentos na busca e esconde ocultos', () => {
        const s = state([
            product(1, 'Café'),
            product(2, 'Sabão', { category: 'limpeza' }),
            product(3, 'Cafeteira', { visible: false }),
        ]);
        const groups = groupVisibleProducts(s, 'cafe', NOW);
        expect(groups.map(g => g.category)).toEqual(['armarios']);
        expect(groups[0].products.map(p => p.name)).toEqual(['Café']);
    });

    it('não altera o estado original (imutável)', () => {
        const s = state([product(1, 'Arroz')]);
        toggleSelection(s, 1);
        expect(s.products[0].selected).toBe(false);
    });
});

describe('ciclos', () => {
    it('imprimir registra o ciclo, conta pulos e limpa a seleção', () => {
        const s = simulate(6);
        expect(s.totalCycles).toBe(6);
        const [arroz, cafe, sabao] = s.products;
        expect(arroz.history).toHaveLength(6);
        expect(arroz.pattern).toMatchObject({ appearCount: 6, confidencePhase: 'established', patternType: 'regular' });
        expect(cafe.history.map(h => h.cycle)).toEqual([2, 4, 6]);
        expect(sabao.pattern).toMatchObject({ totalLists: 6, appearCount: 0 });
        expect(s.products.every(p => !p.selected)).toBe(true);
    });

    it('excluir um ciclo renumera os demais pela data', () => {
        const s = deleteCycle(simulate(4), 2);
        expect(s.totalCycles).toBe(3);
        expect(getAllCycles(s).map(c => c.number)).toEqual([1, 2, 3]);
        expect(s.products[1].history.map(h => h.cycle)).toEqual([3]);
    });

    it('recomenda produtos com padrão estabelecido', () => {
        const { established, learning } = generateRecommendations(simulate(8), NOW);
        const names = [...established, ...learning].map(r => r.product.name);
        expect(names).toContain('Arroz');
        expect(established.find(r => r.product.name === 'Arroz')?.recommendedQty).toBe(2);
    });

    it('descreve o intervalo arredondado', () => {
        expect(cycleLabel({ ...createDefaultPattern(), avgIntervalCycles: 1.3 })).toBe('toda lista');
        expect(cycleLabel({ ...createDefaultPattern(), avgIntervalCycles: 2.6 })).toBe('a cada 3 listas');
    });
});

describe('diferenças para o banco', () => {
    it('envia apenas o que mudou', () => {
        const before = state([product(1, 'Arroz'), product(2, 'Café')]);
        expect(diffState(before, before)).toBeNull();

        const changes = diffState(before, toggleSelection(before, 2))!;
        expect(changes.products.map(p => p.id)).toEqual([2]);
        expect(changes.upsertedPurchases).toEqual([]);
        expect(changes.settings).toBeNull();
    });

    it('detecta compras novas e removidas', () => {
        const printed = simulate(2);
        const changes = diffState(printed, deleteCycle(printed, 1))!;
        expect(changes.deletedPurchases).toContainEqual({ productId: 1, cycle: 2 });
        expect(changes.settings?.totalCycles).toBe(1);
    });

    it('não reenvia compras de produtos excluídos', () => {
        const printed = simulate(2);
        const after = { ...printed, products: printed.products.filter(p => p.id !== 1) };
        const changes = diffState(printed, after)!;
        expect(changes.deletedProductIds).toEqual([1]);
        expect(changes.deletedPurchases.every(p => p.productId !== 1)).toBe(true);
    });

    it('limpar seleção sem itens selecionados não grava nada', () => {
        const s = state([product(1, 'Arroz')]);
        expect(diffState(s, clearSelection(s))).toBeNull();
    });
});

describe('arquivos', () => {
    it('lê o lista.json do app desktop (v4/v5) com histórico', () => {
        const legacy = {
            version: 4,
            totalListsGlobal: 3,
            lastDecayCheckIndex: 0,
            products: [{
                id: 7, name: 'Arroz', category: 'armarios', imageUrl: '',
                annualHistory: { 2026: [
                    { date: '2026-01-07', quantity: 2, listId: 1, listIndex: 1 },
                    { date: '2026-01-21', quantity: 1, listId: 3, listIndex: 3 },
                ] },
                purchasePattern: { appearCount: 2, totalLists: 3 },
            }],
        };
        const backup = parseBackup(legacy, NOW)!;
        expect(backup.totalCycles).toBe(3);
        expect(backup.products[0].history).toEqual([
            { cycle: 1, date: '2026-01-07', quantity: 2 },
            { cycle: 3, date: '2026-01-21', quantity: 1 },
        ]);
        expect(backup.products[0].pattern.patternType).toBe('insufficient');
    });

    it('lê lista simples antiga sem histórico e rejeita formato desconhecido', () => {
        expect(parseBackup([{ name: 'Arroz' }], NOW)?.products[0].name).toBe('Arroz');
        expect(parseBackup({ foo: 1 }, NOW)).toBeNull();
    });

    it('lê exportação de ciclo e ignora itens inválidos', () => {
        const cycle = parseCycleExport({
            type: 'shopping-cycle-export',
            cycle: { date: '2026-02-01', items: [{ productName: ' Arroz ', category: 'x', quantity: '3' }, { productName: '' }] },
        }, NOW);
        expect(cycle).toEqual({ date: '2026-02-01', items: [{ productName: 'Arroz', category: 'outros', quantity: 3 }] });
    });

    it('gera a impressão em colunas e escapa HTML', () => {
        const html = buildPrintDocument('24/10/2026', [{ name: '<b>Arroz</b>', quantity: 2 }]);
        expect(html).toContain('column-count: 3');
        expect(html).toContain('&lt;b&gt;Arroz&lt;/b&gt;');
    });
});
