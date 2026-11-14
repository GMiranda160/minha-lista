import type { Category, CategoryInput, PatternType } from './types';

/**
 * Categorias criadas para toda conta nova e usadas para ler backups antigos,
 * em que a categoria era uma chave fixa. Mantenha em sincronia com
 * seed_default_categories em supabase/migrations.
 */
export const DEFAULT_CATEGORIES: (CategoryInput & { legacyKey: string })[] = [
    { legacyKey: 'geladeira', name: 'Geladeira', color: '#0d9488', icon: 'snowflake' },
    { legacyKey: 'freezer', name: 'Freezer', color: '#2563eb', icon: 'box' },
    { legacyKey: 'armarios', name: 'Armários', color: '#d97706', icon: 'package' },
    { legacyKey: 'limpeza', name: 'Limpeza', color: '#7c3aed', icon: 'spray-can' },
    { legacyKey: 'higiene', name: 'Higiene', color: '#db2777', icon: 'sparkles' },
    { legacyKey: 'outros', name: 'Outros', color: '#64748b', icon: 'tag' },
];

/** Cores oferecidas no cadastro de categoria. */
export const CATEGORY_COLORS = [
    '#0d9488', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#64748b',
    '#16a34a', '#dc2626', '#0891b2', '#ca8a04', '#9333ea', '#ea580c',
];

/** Ícones oferecidos no cadastro de categoria (chaves; a tela escolhe o desenho). */
export const CATEGORY_ICONS = [
    'snowflake', 'box', 'package', 'spray-can', 'sparkles', 'tag',
    'apple', 'carrot', 'beef', 'fish', 'drumstick', 'egg',
    'milk', 'croissant', 'wheat', 'cookie', 'candy', 'coffee',
    'cup-soda', 'wine', 'pill', 'bath', 'baby', 'dog',
    'cat', 'shirt', 'house', 'leaf', 'shopping-basket', 'shapes',
] as const;

export const CATEGORY_NAME_MAX = 40;

/** Categoria exibida para um produto cuja categoria não existe mais. */
export const MISSING_CATEGORY: Category = { id: -1, name: 'Sem categoria', color: '#64748b', icon: 'tag', position: Number.MAX_SAFE_INTEGER };

export const PATTERN_TYPE_LABELS: Partial<Record<PatternType, string>> = {
    regular: 'Regular',
    'semi-regular': 'Semi-regular',
    irregular: 'Irregular',
    sporadic: 'Esporádico',
    declining: 'Declinando',
};

export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MONTH_FULL_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/* Parâmetros do motor de recomendação */
export const DECAY_FACTOR = 0.85;
export const DECAY_INTERVAL = 50;
export const RECOMMENDATION_THRESHOLD = 0.35;
export const MIN_LISTS_FOR_RECOMMENDATION = 3;
export const ESTABLISHED_THRESHOLD = 5;
export const URGENCY_ALPHA = 2.5;
export const URGENCY_DECAY = 1.5;

export const SCORE_WEIGHTS = {
    frequency: 0.40,
    urgency: 0.40,
    seasonal: 0.10,
    consistencyBonus: 0.10,
};

/* Probabilidade de compra (recomendações) */
/** Peso, em listas, da taxa média da casa usada como ponto de partida de cada produto. */
export const PROBABILITY_PRIOR_WEIGHT = 2;
/** Taxa usada enquanto nenhum produto tem histórico. */
export const DEFAULT_BASE_RATE = 0.15;
/** Calibração: usa as últimas listas, só com pelo menos estas listas de histórico e amostras. */
export const CALIBRATION_MAX_LISTS = 40;
export const CALIBRATION_MIN_LISTS = 2;
export const CALIBRATION_MIN_SAMPLES = 150;
/** Quanto a inclinação da calibração é puxada para 1 (sem correção de escala). */
export const CALIBRATION_SLOPE_PRIOR = 5;
/** A partir daqui a recomendação é "garantida". */
export const SURE_PROBABILITY = 0.6;

/* Recomendações com IA */
export const AI_MAX_CANDIDATES = 200;
export const AI_REASON_MAX = 120;
