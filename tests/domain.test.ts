import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup, parseCycleExport } from '@/domain/backup';
import { removeCategory, resolveCategoryId, updateCategory, validateCategoryName } from '@/domain/categories';
import { diffState } from '@/domain/changes';
import { deleteCycle, getAllCycles, registerList } from '@/domain/cycles';
import { DEFAULT_CATEGORIES } from '@/domain/constants';
import { clearSelection, groupCatalog, groupVisibleProducts, setQuantity, toggleSelection } from '@/domain/list';
import { cycleLabel, createDefaultPattern } from '@/domain/pattern';
import { buildPrintDocument } from '@/domain/print';
import { parseAiPicks, resolveAiPicks } from '@/domain/recommendationAi';
import { baseRate, createProbability, purchaseProbability } from '@/domain/probability';
import { applyRecommendations, generateRecommendations } from '@/domain/recommendations';
import { normalizeProduct } from '@/domain/state';
import type { AppState, Product } from '@/domain/types';

const NOW = new Date(2026, 9, 24);

/** Categorias padrão com ids 1 a 6 (Geladeira=1 ... Armários=3, Limpeza=4, Outros=6). */
const CATEGORIES = DEFAULT_CATEGORIES.map(({ name, color, icon }, i) => ({ id: i + 1, name, color, icon, position: i + 1 }));
const ARMARIOS = 3;
const LIMPEZA = 4;

function product(id: number, name: string, extra: Partial<Product> = {}): Product {
    return normalizeProduct({ id, name, categoryId: ARMARIOS, ...extra });
}

function state(products: Product[], totalCycles = 0): AppState {
    return { categories: CATEGORIES, products, totalCycles, lastDecayCheck: 0, sortMode: 'alpha', sortDirection: 'asc' };
}

/** Simula N listas em que "Arroz" é comprado sempre e "Café" a cada duas. */
function simulate(lists: number): AppState {
    let s = state([product(1, 'Arroz'), product(2, 'Café'), product(3, 'Sabão', { categoryId: LIMPEZA })]);
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
            product(2, 'Sabão', { categoryId: LIMPEZA }),
            product(3, 'Cafeteira', { visible: false }),
        ]);
        const groups = groupVisibleProducts(s, 'cafe', NOW);
        expect(groups.map(g => g.category.name)).toEqual(['Armários']);
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
        const { established, learning } = generateRecommendations(simulate(8));
        const names = [...established, ...learning].map(r => r.product.name);
        expect(names).toContain('Arroz');
        expect(established.find(r => r.product.name === 'Arroz')?.recommendedQty).toBe(2);
    });

    it('calcula a probabilidade de compra suavizada pela taxa média', () => {
        const s = simulate(8);
        const [arroz, cafe, sabao] = s.products;
        const base = baseRate(s);
        expect(purchaseProbability(arroz, base)).toBeGreaterThan(0.85);
        expect(purchaseProbability(cafe, base)).toBeCloseTo(0.55, 2);
        expect(purchaseProbability(sabao, base)).toBeLessThan(purchaseProbability(cafe, base));
        expect(generateRecommendations(s).established.map(r => r.product.name)).toEqual(['Arroz']);
    });

    it('a calibração mantém as probabilidades válidas e a ordem dos produtos', () => {
        const s = simulate(30);
        const probability = createProbability(s);
        const [arroz, cafe, sabao] = s.products.map(probability);
        [arroz, cafe, sabao].forEach(p => { expect(p).toBeGreaterThan(0); expect(p).toBeLessThan(1); });
        expect(arroz).toBeGreaterThan(cafe);
        expect(cafe).toBeGreaterThan(sabao);
    });

    it('não recomenda produto oculto nem o seleciona ao aplicar', () => {
        const base = simulate(8);
        const hidden = { ...base, products: base.products.map(p => (p.id === 1 ? { ...p, visible: false } : p)) };
        const names = Object.values(generateRecommendations(hidden)).flat().map(r => r.product.name);
        expect(names).not.toContain('Arroz');

        const picks = [{ product: hidden.products[0], recommendedQty: 2 }];
        expect(applyRecommendations(hidden, picks).products[0].selected).toBe(false);
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
        expect(backup.products[0].category).toBe('Armários');
        expect(backup.categories.map(c => c.name)).toEqual(DEFAULT_CATEGORIES.map(c => c.name));
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
        expect(cycle).toEqual({ date: '2026-02-01', items: [{ productName: 'Arroz', category: 'x', quantity: 3 }] });
    });

    it('gera a impressão em paisagem, em colunas e escapa HTML', () => {
        const html = buildPrintDocument('24/10/2026', [{ name: '<b>Arroz</b>', quantity: 2 }]);
        expect(html).toContain('size: A4 landscape');
        expect(html).toContain('size: 297mm 210mm');
        expect(html).toContain('column-count: 3');
        expect(html).toContain('font-size: 17px');
        expect(html).toContain('.print-date { font-size: 16px');
        expect(html).toContain('&lt;b&gt;Arroz&lt;/b&gt;');
    });
});

describe('categorias', () => {
    it('agrupa o catálogo na ordem das categorias, inclusive ocultos', () => {
        const s = state([product(1, 'Sabão', { categoryId: LIMPEZA }), product(2, 'Arroz', { visible: false })]);
        expect(groupCatalog(s, '', 'all').map(g => g.category.name)).toEqual(['Armários', 'Limpeza']);
        expect(groupCatalog(s, '', LIMPEZA).map(g => g.products.length)).toEqual([1]);
    });

    it('produto sem categoria existente vai para "Sem categoria" no fim', () => {
        const groups = groupVisibleProducts(state([product(1, 'Arroz', { categoryId: 99 })]), '', NOW);
        expect(groups.map(g => g.category.name)).toEqual(['Sem categoria']);
    });

    it('remover move os produtos para a categoria escolhida', () => {
        const s = state([product(1, 'Arroz'), product(2, 'Sabão', { categoryId: LIMPEZA })]);
        const after = removeCategory(s, ARMARIOS, LIMPEZA);
        expect(after.categories.map(c => c.id)).not.toContain(ARMARIOS);
        expect(after.products.map(p => p.categoryId)).toEqual([LIMPEZA, LIMPEZA]);

        const changes = diffState(s, after)!;
        expect(changes.deletedCategoryIds).toEqual([ARMARIOS]);
        expect(changes.products.map(p => p.id)).toEqual([1]);
    });

    it('não remove categoria com produtos sem destino, nem a última', () => {
        const s = state([product(1, 'Arroz')]);
        expect(removeCategory(s, ARMARIOS)).toBe(s);
        const single = { ...state([]), categories: [CATEGORIES[0]] };
        expect(removeCategory(single, 1)).toBe(single);
    });

    it('valida nome vazio, longo e repetido (sem diferenciar maiúsculas)', () => {
        const s = state([]);
        expect(validateCategoryName(s, '  ')).toMatch(/Informe/);
        expect(validateCategoryName(s, 'x'.repeat(41))).toMatch(/40/);
        expect(validateCategoryName(s, 'limpeza')).toMatch(/Já existe/);
        expect(validateCategoryName(s, 'Limpeza', LIMPEZA)).toBeNull();
        expect(validateCategoryName(s, 'Hortifrúti')).toBeNull();
    });

    it('editar gera só a categoria alterada na gravação', () => {
        const s = state([]);
        const changes = diffState(s, updateCategory(s, LIMPEZA, { name: 'Casa', color: '#16a34a', icon: 'house' }))!;
        expect(changes.categories).toEqual([{ id: LIMPEZA, name: 'Casa', color: '#16a34a', icon: 'house', position: 4 }]);
        expect(changes.products).toEqual([]);
    });

    it('encontra a categoria pelo nome ou pela chave antiga', () => {
        const s = state([]);
        expect(resolveCategoryId(s, 'LIMPEZA')).toBe(LIMPEZA);
        expect(resolveCategoryId(s, 'armarios')).toBe(ARMARIOS);
        expect(resolveCategoryId(s, 'inexistente')).toBe(1);
    });

    it('backup novo guarda categorias e volta igual', () => {
        const s = state([product(1, 'Sabão', { categoryId: LIMPEZA })]);
        const restored = parseBackup(JSON.parse(JSON.stringify(createBackup(s, NOW))), NOW)!;
        expect(restored.categories).toHaveLength(6);
        expect(restored.products[0].category).toBe('Limpeza');
    });
});

describe('recomendações com IA', () => {
    it('valida a resposta do Gemini e descarta itens malformados', () => {
        const text = JSON.stringify({ itens: [
            { id: 1, motivo: ' compra toda lista ' },
            { id: 'x', motivo: 'id inválido' },
            { id: 2, quantidade: 5, motivo: 3 },
        ] });
        expect(parseAiPicks(text)).toEqual([
            { productId: 1, reason: 'compra toda lista' },
            { productId: 2, reason: '' },
        ]);
        expect(() => parseAiPicks('não é json')).toThrow();
        expect(() => parseAiPicks('{}')).toThrow();
    });

    it('mantém quantidades grandes (gramas) vindas do histórico, sem limite', () => {
        const base = simulate(8);
        const grams = { ...base, products: base.products.map(p => (p.id === 1 ? { ...p, history: p.history.map(h => ({ ...h, quantity: 300 })) } : p)) };
        const groups = resolveAiPicks(grams, [{ productId: 1, reason: 'x' }]);
        expect([...groups.established, ...groups.learning][0].recommendedQty).toBe(300);
    });

    it('resolve as escolhas ignorando ids inexistentes, ocultos e repetidos', () => {
        const base = simulate(8);
        const s = { ...base, products: base.products.map(p => (p.id === 3 ? { ...p, visible: false } : p)) };
        const groups = resolveAiPicks(s, [
            { productId: 1, reason: 'acaba rápido' },
            { productId: 1, reason: 'repetido' },
            { productId: 3, reason: 'oculto' },
            { productId: 99, reason: 'inexistente' },
        ]);
        const all = [...groups.established, ...groups.learning];
        expect(all.map(r => r.product.id)).toEqual([1]);
        expect(all[0]).toMatchObject({ recommendedQty: 2, context: 'acaba rápido' });
    });
});
