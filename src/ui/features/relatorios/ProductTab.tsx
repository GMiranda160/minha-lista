'use client';

import { ArrowLeft, ChartLine, Check, Clock, RefreshCw, Search, Weight, X } from 'lucide-react';
import { useState } from 'react';
import { categoryOf } from '@/domain/categories';
import { PATTERN_TYPE_LABELS } from '@/domain/constants';
import { scoreContext } from '@/domain/recommendations';
import { getProductDetail, getProductSummaries, type PatternStatus } from '@/domain/reports';
import { findProduct } from '@/domain/state';
import { formatDate } from '@/domain/text';
import type { AppState, Product } from '@/domain/types';
import { CategoryTag } from '@/ui/components/CategoryTag';
import { EmptyState } from '@/ui/components/EmptyState';
import { ReportCard, StatCard } from '@/ui/components/StatCard';

const STATUS_TITLES: Record<PatternStatus, string> = {
    established: 'Padrão garantido',
    learning: 'Em aprendizado',
    broken: 'Reaprendendo padrão',
    insufficient: 'Sem dados suficientes',
};

export function ProductTab({ state }: { state: AppState }) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const product = selectedId !== null ? findProduct(state, selectedId) : undefined;

    if (product) return <ProductDetail product={product} onBack={() => setSelectedId(null)} />;

    const summaries = getProductSummaries(state, scoreContext(state));
    if (summaries.length === 0) {
        return (
            <EmptyState icon={Search} title="Nenhum produto com histórico">
                Nenhum produto foi comprado ainda. Imprima listas para gerar dados.
            </EmptyState>
        );
    }

    return (
        <div className="summary-grid">
            {summaries.map(({ product: p, freqPct, score, status }) => (
                <button key={p.id} type="button" className="summary-card" onClick={() => setSelectedId(p.id)}>
                    <span className={`status-badge ${status}`} title={STATUS_TITLES[status]}>
                        {status === 'established' ? <Check size={12} /> : status === 'insufficient' ? <X size={12} /> : <RefreshCw size={12} />}
                    </span>
                    <span className="summary-name">{p.name}</span>
                    <span className="summary-category">
                        <CategoryTag category={categoryOf(state, p)} />
                    </span>
                    <span className="summary-stats"><RefreshCw size={10} /> {freqPct}% · {p.pattern.appearCount}x</span>
                    <span className="bar"><span className="bar-fill" style={{ width: `${freqPct}%` }} /></span>
                    {score > 0 && <span className="summary-stats">Score: {Math.round(score * 100)}%</span>}
                </button>
            ))}
        </div>
    );
}

function ProductDetail({ product, onBack }: { product: Product; onBack: () => void }) {
    const pp = product.pattern;
    const detail = getProductDetail(product);
    const phase = pp.patternBroken ? 'Padrão quebrado' : pp.confidencePhase === 'established' ? 'Estabelecido' : 'Aprendendo';

    return (
        <>
            <button type="button" className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Todos os produtos</button>
            <h3 className="detail-title">{product.name}</h3>
            <div className="reports-grid">
                <StatCard
                    icon={Weight}
                    tone="blue"
                    title="Quantidade média"
                    value={product.history.length > 0 ? detail.avgQty : '-'}
                    label={`por compra · ${detail.totalQty} no total`}
                />
                <StatCard
                    icon={RefreshCw}
                    title="Frequência"
                    value={`${pp.appearCount}x`}
                    label={pp.totalLists > 0 ? `${detail.freqPct}% das listas` : ''}
                />
                <StatCard
                    icon={ChartLine}
                    tone={pp.patternBroken ? 'red' : 'orange'}
                    title="Padrão"
                    value={PATTERN_TYPE_LABELS[pp.patternType] ?? '-'}
                    label={phase}
                />
                <ReportCard icon={Clock} tone="purple" title="Histórico de compras" className="full">
                    {product.history.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th>Ciclo</th><th>Data</th><th className="num">Quantidade</th></tr></thead>
                                <tbody>
                                    {product.history.map(h => (
                                        <tr key={h.cycle}><td>#{h.cycle}</td><td>{formatDate(h.date)}</td><td className="num">{h.quantity}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="muted">Sem histórico disponível</p>}
                </ReportCard>
            </div>
        </>
    );
}
