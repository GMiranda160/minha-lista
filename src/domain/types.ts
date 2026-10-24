/* =================================================================
   Tipos do domínio. Nenhum arquivo de domain/ conhece banco ou tela.
   ================================================================= */

/** Categoria criada pelo usuário. `icon` é a chave de um ícone de CATEGORY_ICONS. */
export interface Category {
    id: number;
    name: string;
    color: string;
    icon: string;
    position: number;
}

/** Dados editáveis de uma categoria no formulário. */
export type CategoryInput = Pick<Category, 'name' | 'color' | 'icon'>;

export type PatternType = 'insufficient' | 'regular' | 'semi-regular' | 'irregular' | 'sporadic' | 'declining';

export type ConfidencePhase = 'insufficient' | 'learning' | 'established';

export type PatternState = ConfidencePhase | 'transitioning';

export type SortMode = 'alpha' | 'frequency';

export type SortDirection = 'asc' | 'desc';

/** Estado do padrão de compra de um produto, medido em ciclos (listas impressas). */
export interface PurchasePattern {
    totalLists: number;
    appearCount: number;
    avgQuantity: number;
    avgIntervalCycles: number;
    intervalCycleStdDev: number;
    patternType: PatternType;
    confidencePhase: ConfidencePhase;
    lastPurchaseListIndex: number;
    lastDecayListIndex: number;
    /** Chave: mês (0 a 11). */
    monthlyAppearances: Record<string, number>;
    skipsSinceLastPurchase: number;
    patternBroken: boolean;
    consecutiveSelections: number;
    patternState: PatternState;
    patternBreakListIndex: number;
    shortTermInterval: number;
    shortTermCV: number;
    longTermInterval: number;
    intervalHistory: number[];
}

/** Uma compra: o produto apareceu no ciclo `cycle`. */
export interface Purchase {
    cycle: number;
    /** Data local no formato AAAA-MM-DD. */
    date: string;
    quantity: number;
}

export interface Product {
    id: number;
    name: string;
    imageUrl: string;
    categoryId: number;
    visible: boolean;
    selected: boolean;
    quantity: number;
    /** Ordenado por ciclo, no máximo uma compra por ciclo. */
    history: Purchase[];
    pattern: PurchasePattern;
}

export interface AppState {
    /** Ordenadas por posição. */
    categories: Category[];
    products: Product[];
    totalCycles: number;
    lastDecayCheck: number;
    sortMode: SortMode;
    sortDirection: SortDirection;
}

/** Dados editáveis de um produto no formulário de cadastro. */
export interface ProductInput {
    name: string;
    imageUrl: string;
    categoryId: number;
}

/** Item de uma lista impressa ou de um ciclo. */
export interface ListItem {
    name: string;
    quantity: number;
}

export interface CycleItem {
    productId: number;
    productName: string;
    categoryId: number;
    quantity: number;
}

export interface Cycle {
    number: number;
    date: string;
    items: CycleItem[];
}
