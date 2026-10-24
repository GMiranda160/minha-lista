'use client';

import { ChevronDown } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import type { Category } from '@/domain/types';
import { CategoryIcon } from './CategoryIcon';

interface CategoryPanelProps {
    category: Category;
    count: number;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
}

/** Cartão retrátil de uma categoria, com os produtos dela agrupados dentro. */
export function CategoryPanel({ category, count, open, onToggle, children }: CategoryPanelProps) {
    const bodyId = useId();
    return (
        <section
            className={`category-panel ${open ? 'open' : ''}`}
            style={{ '--category-color': category.color } as CSSProperties}
        >
            <button type="button" className="category-panel-header" onClick={onToggle} aria-expanded={open} aria-controls={bodyId}>
                <span className="category-panel-icon"><CategoryIcon icon={category.icon} size={20} /></span>
                <h3 className="category-panel-title">{category.name}</h3>
                <span className="category-panel-count">{count}</span>
                <ChevronDown size={20} className="category-panel-chevron" aria-hidden />
            </button>
            <div id={bodyId} className="category-panel-body" inert={!open}>
                <div className="category-panel-clip">
                    <div className="category-panel-content">{children}</div>
                </div>
            </div>
        </section>
    );
}
