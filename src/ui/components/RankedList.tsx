import type { RankedItem } from '@/domain/reports';

/** Ranking com barra proporcional (Top 10). */
export function RankedList({ items, label }: { items: RankedItem[]; label: (item: RankedItem) => string }) {
    return (
        <ol className="ranked-list">
            {items.map((item, index) => (
                <li key={item.name} className="ranked-item">
                    <span className="ranked-pos">#{index + 1}</span>
                    <span className="ranked-name">{item.name}</span>
                    <span className="ranked-value">{label(item)}</span>
                    <span className="bar"><span className="bar-fill" style={{ width: `${Math.min(100, item.pct)}%` }} /></span>
                </li>
            ))}
        </ol>
    );
}
