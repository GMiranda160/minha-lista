import type { Category } from '@/domain/types';

/** Ponto colorido + nome da categoria, para textos de apoio. */
export function CategoryTag({ category }: { category: Category }) {
    return (
        <span className="category-tag">
            <span className="category-dot" style={{ background: category.color }} aria-hidden /> {category.name}
        </span>
    );
}
