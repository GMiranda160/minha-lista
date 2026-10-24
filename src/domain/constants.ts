import type { Category, PatternType } from './types';

export const CATEGORIES: Record<Category, string> = {
    geladeira: 'Geladeira',
    freezer: 'Freezer',
    armarios: 'Armários',
    limpeza: 'Limpeza',
    higiene: 'Higiene',
    outros: 'Outros',
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const CATEGORY_COLORS: Record<Category, string> = {
    geladeira: '#0d9488',
    freezer: '#2563eb',
    armarios: '#d97706',
    limpeza: '#7c3aed',
    higiene: '#db2777',
    outros: '#64748b',
};

export const PATTERN_TYPE_LABELS: Partial<Record<PatternType, string>> = {
    regular: 'Regular',
    'semi-regular': 'Semi-regular',
    irregular: 'Irregular',
    sporadic: 'Esporádico',
    declining: 'Declinando',
};

export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

export const isCategory = (value: unknown): value is Category =>
    typeof value === 'string' && value in CATEGORIES;
