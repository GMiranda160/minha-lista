'use client';

import { Boxes, CalendarDays, Layers, ListChecks, Receipt, Star, Trophy } from 'lucide-react';
import { useState } from 'react';
import { MONTH_NAMES } from '@/domain/constants';
import {
    getCategoryAverages, getMonthlyTotals, getMonthOverview, getTopItems, productsWithHistory,
} from '@/domain/reports';
import type { AppState } from '@/domain/types';
import { CategorySquares } from '@/ui/components/CategorySquares';
import { RankedList } from '@/ui/components/RankedList';
import { ReportCard, StatCard } from '@/ui/components/StatCard';

/** Visão anual ou de um mês específico. */
export function OverviewTab({ state }: { state: AppState }) {
    const [month, setMonth] = useState<number | null>(null);

    return (
        <>
            <div className="month-bar">
                <button type="button" className={`month-btn ${month === null ? 'active' : ''}`} onClick={() => setMonth(null)}>Anual</button>
                {MONTH_NAMES.map((name, i) => (
                    <button key={name} type="button" className={`month-btn ${month === i ? 'active' : ''}`} onClick={() => setMonth(i)}>
                        {name}
                    </button>
                ))}
            </div>
            {month === null ? <AnnualView state={state} /> : <MonthView state={state} month={month} />}
        </>
    );
}

function AnnualView({ state }: { state: AppState }) {
    const top = getTopItems(state);
    const monthly = getMonthlyTotals(state);
    const maxMonth = Math.max(...monthly, 1);
    const currentMonth = new Date().getMonth();

    return (
        <div className="reports-grid">
            <StatCard icon={Receipt} title="Listas realizadas" value={state.totalCycles} label="listas impressas no total" />
            <StatCard
                icon={Boxes}
                tone="purple"
                title="Produtos cadastrados"
                value={state.products.length}
                label={`${productsWithHistory(state).length} com histórico de compra`}
            />
            <StatCard
                icon={Star}
                tone="blue"
                title="Item mais frequente"
                value={top[0]?.name ?? 'Nenhum'}
                label={top[0] ? `${top[0].count} aparições (${top[0].pct}% das listas)` : 'Nenhum item registrado'}
            />
            <ReportCard icon={Trophy} tone="orange" title="Top 10 itens mais frequentes" className="wide">
                {top.length > 0
                    ? <RankedList items={top.slice(0, 10)} label={item => `${item.pct}%`} />
                    : <p className="muted">Sem dados de frequência</p>}
            </ReportCard>
            <ReportCard icon={Layers} title="Média por lista, por categoria">
                <CategorySquares totals={getCategoryAverages(state)} />
            </ReportCard>
            <ReportCard icon={CalendarDays} tone="blue" title="Atividade por mês" className="full">
                <div className="monthly-grid">
                    {MONTH_NAMES.map((name, i) => {
                        const highlight = (monthly[i] > 0 && monthly[i] >= maxMonth * 0.7) || i === currentMonth;
                        return (
                            <div key={name} className={`monthly-cell ${highlight ? 'highlight' : ''}`}>
                                <span>{name}</span>
                                <strong>{monthly[i]}</strong>
                            </div>
                        );
                    })}
                </div>
            </ReportCard>
        </div>
    );
}

function MonthView({ state, month }: { state: AppState; month: number }) {
    const data = getMonthOverview(state, month);
    const label = MONTH_NAMES[month];
    const top = data.items[0];

    return (
        <div className="reports-grid">
            <StatCard
                icon={Receipt}
                title={`Aparições em ${label}`}
                value={data.totalAppearances}
                label={`${data.totalProducts} produtos diferentes`}
            />
            <StatCard icon={ListChecks} tone="purple" title="Listas no mês" value={data.cycleCount} label={`listas criadas em ${label}`} />
            <StatCard
                icon={Star}
                tone="blue"
                title="Item do mês"
                value={top?.name ?? 'Nenhum'}
                label={top ? `${top.count} aparições no mês` : 'Nenhum item neste mês'}
            />
            <ReportCard icon={Trophy} tone="orange" title={`Top 10 itens: ${label}`} className="wide">
                {data.items.length > 0
                    ? <RankedList items={data.items.slice(0, 10)} label={item => `${item.count} aparições`} />
                    : <p className="muted">Sem dados neste mês</p>}
            </ReportCard>
            <ReportCard icon={Layers} title={`Categorias: ${label}`}>
                <CategorySquares totals={data.categories} digits={0} />
            </ReportCard>
        </div>
    );
}
