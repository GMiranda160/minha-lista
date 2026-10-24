'use client';

import type { ReactNode } from 'react';
import type { CategoryGroup } from '@/domain/list';
import type { Product } from '@/domain/types';
import { useCollapsed } from '@/ui/lib/useCollapsed';
import { CategoryPanel } from './CategoryPanel';

interface CategoryGroupsProps {
    groups: CategoryGroup[];
    /** Chave para lembrar, neste aparelho, quais categorias estão recolhidas. */
    storageKey: string;
    /** Abre todas (ex.: durante uma busca, para não esconder resultados). */
    forceOpen?: boolean;
    gridClassName: string;
    renderProduct: (product: Product) => ReactNode;
}

/** Produtos agrupados em cartões de categoria retráteis (Lista e Catálogo). */
export function CategoryGroups({ groups, storageKey, forceOpen = false, gridClassName, renderProduct }: CategoryGroupsProps) {
    const { isCollapsed, toggle } = useCollapsed(storageKey);
    return (
        <div className="category-groups">
            {groups.map(({ category, products }) => (
                <CategoryPanel
                    key={category.id}
                    category={category}
                    count={products.length}
                    open={forceOpen || !isCollapsed(category.id)}
                    onToggle={() => toggle(category.id)}
                >
                    <div className={gridClassName}>{products.map(renderProduct)}</div>
                </CategoryPanel>
            ))}
        </div>
    );
}
