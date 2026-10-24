import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type Tone = 'teal' | 'purple' | 'blue' | 'orange' | 'red';

interface CardProps {
    icon: LucideIcon;
    title: string;
    tone?: Tone;
    className?: string;
    children: ReactNode;
}

/** Cartão de relatório com ícone e título. */
export function ReportCard({ icon: Icon, title, tone = 'teal', className = '', children }: CardProps) {
    return (
        <section className={`report-card ${className}`}>
            <header className="report-card-header">
                <span className={`report-card-icon tone-${tone}`}><Icon size={18} aria-hidden /></span>
                <h3>{title}</h3>
            </header>
            {children}
        </section>
    );
}

interface StatCardProps extends Omit<CardProps, 'children'> {
    value: ReactNode;
    label: ReactNode;
}

/** Cartão com um número em destaque. */
export function StatCard({ value, label, ...card }: StatCardProps) {
    return (
        <ReportCard {...card}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </ReportCard>
    );
}
