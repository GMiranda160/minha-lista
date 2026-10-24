import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <Icon size={40} aria-hidden />
            <p className="empty-state-title">{title}</p>
            {children && <div className="empty-state-text">{children}</div>}
        </div>
    );
}
