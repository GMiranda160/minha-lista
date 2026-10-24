'use client';

import { DECAY_FACTOR, DECAY_INTERVAL } from '@/domain/constants';
import { scoreContext } from '@/domain/recommendations';
import { getAnalysisRows, getPatternHealth, productsWithHistory } from '@/domain/reports';
import type { AppState } from '@/domain/types';

/** Números técnicos do motor de recomendação. */
export function DataTab({ state }: { state: AppState }) {
    const rows = getAnalysisRows(state, scoreContext(state));
    const health = getPatternHealth(state);

    return (
        <>
            <div className="metric-row">
                <Metric title="Saúde média dos padrões" value={health.avgCV} note={`CV médio (${health.establishedCount} estabelecidos)`} />
                <Metric
                    title="Produtos com histórico"
                    value={productsWithHistory(state).length}
                    note={`de ${state.products.length} no catálogo`}
                />
                <Metric
                    title="Último decaimento"
                    value={state.lastDecayCheck > 0 ? `#${state.lastDecayCheck}` : 'Nunca'}
                    note={`A cada ${DECAY_INTERVAL} ciclos · Fator ${DECAY_FACTOR}`}
                />
            </div>
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Produto</th><th className="num">Freq</th><th className="num">Urg</th><th className="num">Score</th>
                            <th className="num">CV</th><th>Fase</th><th>Tipo</th><th>Estado</th>
                            <th className="num">Ciclos</th><th className="num">Pulos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.name}>
                                <td className="strong">{r.name}</td>
                                <td className="num">{r.freq}</td>
                                <td className="num">{r.urgency}</td>
                                <td className="num">{r.score}</td>
                                <td className="num">{r.cv}</td>
                                <td>{r.phase}</td>
                                <td>{r.type}</td>
                                <td>{r.state}</td>
                                <td className="num">{r.cyclesSince}</td>
                                <td className="num">{r.skips}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function Metric({ title, value, note }: { title: string; value: string | number; note: string }) {
    return (
        <div className="metric">
            <span className="metric-title">{title}</span>
            <strong className="metric-value">{value}</strong>
            <span className="metric-note">{note}</span>
        </div>
    );
}
