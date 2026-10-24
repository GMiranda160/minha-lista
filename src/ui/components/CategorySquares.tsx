import type { CategoryTotal } from '@/domain/reports';
import { CategoryIcon } from './CategoryIcon';

/** Um quadrado por categoria com o valor formatado. */
export function CategorySquares({ totals, digits = 1 }: { totals: CategoryTotal[]; digits?: number }) {
    if (totals.every(t => t.value === 0)) return <p className="muted">Sem dados de categorias</p>;
    return (
        <div className="category-squares">
            {totals.map(({ category, value }) => (
                <div key={category.id} className="category-square" style={{ borderColor: category.color }}>
                    <span className="category-square-icon" style={{ background: `${category.color}20`, color: category.color }}>
                        <CategoryIcon icon={category.icon} />
                    </span>
                    <strong>{value.toFixed(digits)}</strong>
                    <span>{category.name}</span>
                </div>
            ))}
        </div>
    );
}
