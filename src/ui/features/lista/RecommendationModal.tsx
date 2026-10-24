'use client';

import { ChartColumn, CircleCheck, ClipboardCheck, Hourglass, ListChecks, WandSparkles } from 'lucide-react';
import { MIN_LISTS_FOR_RECOMMENDATION } from '@/domain/constants';
import { generateRecommendations, hasEnoughData, type Recommendation } from '@/domain/recommendations';
import type { AppState } from '@/domain/types';
import { CategoryIcon } from '@/ui/components/CategoryIcon';
import { EmptyState } from '@/ui/components/EmptyState';
import { Modal } from '@/ui/components/Modal';

interface RecommendationModalProps {
    state: AppState;
    onApply: (scope: 'established' | 'all') => void;
    onClose: () => void;
}

export function RecommendationModal({ state, onApply, onClose }: RecommendationModalProps) {
    const title = <><WandSparkles size={18} /> Lista recomendada</>;

    if (!hasEnoughData(state)) {
        return (
            <Modal title={title} onClose={onClose}>
                <EmptyState icon={ChartColumn} title="Sem dados suficientes para recomendações.">
                    Imprima pelo menos {MIN_LISTS_FOR_RECOMMENDATION} listas para gerar padrões.
                </EmptyState>
            </Modal>
        );
    }

    const { established, learning } = generateRecommendations(state);
    if (established.length + learning.length === 0) {
        return (
            <Modal title={title} onClose={onClose}>
                <EmptyState icon={ClipboardCheck} title="Nenhuma recomendação no momento.">
                    Os padrões são refinados a cada ciclo. Continue comprando!
                </EmptyState>
            </Modal>
        );
    }

    return (
        <Modal
            title={title}
            onClose={onClose}
            size="lg"
            footer={
                <>
                    <button type="button" className="btn btn-outline" onClick={() => onApply('established')} disabled={established.length === 0}>
                        <CircleCheck size={16} /> Apenas garantidos
                    </button>
                    <button type="button" className="btn btn-rec" onClick={() => onApply('all')}>
                        <ListChecks size={16} /> Lista completa
                    </button>
                </>
            }
        >
            <div className="rec-summary">
                {established.length > 0 && (
                    <div className="rec-summary-item established">
                        <CircleCheck size={22} /><strong>{established.length}</strong> garantido{established.length > 1 ? 's' : ''}
                    </div>
                )}
                {learning.length > 0 && (
                    <div className="rec-summary-item learning">
                        <Hourglass size={22} /><strong>{learning.length}</strong> em aprendizado
                    </div>
                )}
            </div>
            <div className="rec-list">
                {established.map(r => <RecommendationRow key={r.product.id} rec={r} kind="established" />)}
                {learning.map(r => <RecommendationRow key={r.product.id} rec={r} kind="learning" />)}
            </div>
        </Modal>
    );
}

function RecommendationRow({ rec, kind }: { rec: Recommendation; kind: 'established' | 'learning' }) {
    return (
        <div className="rec-item">
            <span className={`rec-icon ${kind}`}><CategoryIcon category={rec.product.category} /></span>
            <div className="rec-info">
                <div className="rec-name">
                    {rec.product.name}
                    <span className={`rec-tag ${kind}`}>
                        {kind === 'established' ? <><CircleCheck size={11} /> Garantido</> : <><Hourglass size={11} /> Aprendendo</>}
                    </span>
                </div>
                <div className="rec-context">{rec.context}</div>
            </div>
            <span className="rec-qty">x{rec.recommendedQty}</span>
            <span className="rec-score">{Math.round(rec.score * 100)}%</span>
        </div>
    );
}
