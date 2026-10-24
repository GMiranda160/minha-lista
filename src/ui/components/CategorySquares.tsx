import { CATEGORIES, CATEGORY_COLORS, CATEGORY_KEYS } from '@/domain/constants';
import type { CategoryTotals } from '@/domain/reports';
import { CategoryIcon } from './CategoryIcon';

/** Um quadrado por categoria com o valor formatado. */
export function CategorySquares({ totals, digits = 1 }: { totals: CategoryTotals; digits?: number }) {
    if (CATEGORY_KEYS.every(k => totals[k] === 0)) return <p className="muted">Sem dados de categorias</p>;
    return (
        <div className="category-squares">
            {CATEGORY_KEYS.map(category => {
                const color = CATEGORY_COLORS[category];
                return (
                    <div key={category} className="category-square" style={{ borderColor: color }}>
                        <span className="category-square-icon" style={{ background: `${color}20`, color }}>
                            <CategoryIcon category={category} />
                        </span>
                        <strong>{totals[category].toFixed(digits)}</strong>
                        <span>{CATEGORIES[category]}</span>
                    </div>
                );
            })}
        </div>
    );
}
