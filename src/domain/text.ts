/* Utilitários de texto e data usados em todo o domínio. */

/** Remove acentos e caixa para comparar textos digitados pelo usuário. */
export function normalizeText(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function matchesSearch(name: string, term: string): boolean {
    const normalizedTerm = normalizeText(term);
    return !normalizedTerm || normalizeText(name).includes(normalizedTerm);
}

export function compareNames(a: string, b: string): number {
    return a.localeCompare(b, 'pt-BR');
}

export function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Data local (não UTC) no formato AAAA-MM-DD. */
export function toIsoDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/** AAAA-MM-DD para DD/MM/AAAA. */
export function formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

/** Mês (0 a 11) de uma data AAAA-MM-DD. */
export function monthOf(isoDate: string): number {
    return Number(isoDate.slice(5, 7)) - 1;
}

export function isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
    return count === 1 ? singular : pluralForm;
}
