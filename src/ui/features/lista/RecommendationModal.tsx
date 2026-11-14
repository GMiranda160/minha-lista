'use client';

import {
    ChartColumn, CircleCheck, ClipboardCheck, Hourglass, ListChecks, LoaderCircle, Sparkles, TriangleAlert, WandSparkles,
} from 'lucide-react';
import { useState } from 'react';
import { categoryOf } from '@/domain/categories';
import { MIN_LISTS_FOR_RECOMMENDATION } from '@/domain/constants';
import { resolveAiPicks } from '@/domain/recommendationAi';
import {
    generateRecommendations, hasEnoughData, type Recommendation, type RecommendationGroups,
} from '@/domain/recommendations';
import type { AppState } from '@/domain/types';
import { requestAiRecommendations } from '@/services/recommendationActions';
import { CategoryIcon } from '@/ui/components/CategoryIcon';
import { EmptyState } from '@/ui/components/EmptyState';
import { Modal } from '@/ui/components/Modal';

interface RecommendationModalProps {
    state: AppState;
    onApply: (chosen: Recommendation[]) => void;
    onClose: () => void;
}

type Phase =
    | { name: 'idle' }
    | { name: 'loading' }
    | { name: 'error'; message: string }
    | { name: 'done'; groups: RecommendationGroups };

export function RecommendationModal({ state, onApply, onClose }: RecommendationModalProps) {
    const [phase, setPhase] = useState<Phase>({ name: 'idle' });
    const title = <><WandSparkles size={18} /> Lista recomendada</>;

    /* A única chamada ao Gemini acontece aqui, e só por clique. */
    async function generate() {
        setPhase({ name: 'loading' });
        const result = await requestAiRecommendations();
        setPhase(result.ok
            ? { name: 'done', groups: resolveAiPicks(state, result.data) }
            : { name: 'error', message: result.error });
    }

    const useLocal = () => setPhase({ name: 'done', groups: generateRecommendations(state) });

    if (!hasEnoughData(state)) {
        return (
            <Modal title={title} onClose={onClose}>
                <EmptyState icon={ChartColumn} title="Sem dados suficientes para recomendações.">
                    Imprima pelo menos {MIN_LISTS_FOR_RECOMMENDATION} listas para gerar padrões.
                </EmptyState>
            </Modal>
        );
    }

    if (phase.name === 'idle' || phase.name === 'loading') {
        const loading = phase.name === 'loading';
        return (
            <Modal
                title={title}
                onClose={onClose}
                footer={
                    <button type="button" className="btn btn-rec" onClick={generate} disabled={loading}>
                        {loading
                            ? <><LoaderCircle size={16} className="spin" /> Consultando o Gemini...</>
                            : <><Sparkles size={16} /> Gerar recomendações</>}
                    </button>
                }
            >
                <EmptyState icon={Sparkles} title="Recomendar a próxima lista com IA">
                    O Gemini analisa o histórico das suas {state.totalCycles} listas e sugere o que comprar e em que quantidade.
                </EmptyState>
            </Modal>
        );
    }

    if (phase.name === 'error') {
        return (
            <Modal
                title={title}
                onClose={onClose}
                footer={
                    <>
                        <button type="button" className="btn btn-outline" onClick={useLocal}>Usar cálculo local</button>
                        <button type="button" className="btn btn-rec" onClick={generate}>Tentar de novo</button>
                    </>
                }
            >
                <EmptyState icon={TriangleAlert} title="Não foi possível gerar com IA.">{phase.message}</EmptyState>
            </Modal>
        );
    }

    const { established, learning } = phase.groups;
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
                    <button type="button" className="btn btn-outline" onClick={() => onApply(established)} disabled={established.length === 0}>
                        <CircleCheck size={16} /> Só os muito prováveis
                    </button>
                    <button type="button" className="btn btn-rec" onClick={() => onApply([...established, ...learning])}>
                        <ListChecks size={16} /> Lista completa
                    </button>
                </>
            }
        >
            <div className="rec-summary">
                {established.length > 0 && (
                    <div className="rec-summary-item established">
                        <CircleCheck size={22} /><strong>{established.length}</strong> {established.length > 1 ? 'muito prováveis' : 'muito provável'}
                    </div>
                )}
                {learning.length > 0 && (
                    <div className="rec-summary-item learning">
                        <Hourglass size={22} /><strong>{learning.length}</strong> {learning.length > 1 ? 'prováveis' : 'provável'}
                    </div>
                )}
            </div>
            <div className="rec-list">
                {established.map(r => <RecommendationRow key={r.product.id} rec={r} icon={categoryOf(state, r.product).icon} kind="established" />)}
                {learning.map(r => <RecommendationRow key={r.product.id} rec={r} icon={categoryOf(state, r.product).icon} kind="learning" />)}
            </div>
        </Modal>
    );
}

function RecommendationRow({ rec, icon, kind }: { rec: Recommendation; icon: string; kind: 'established' | 'learning' }) {
    return (
        <div className="rec-item">
            <span className={`rec-icon ${kind}`}><CategoryIcon icon={icon} /></span>
            <div className="rec-info">
                <div className="rec-name">
                    {rec.product.name}
                    <span className={`rec-tag ${kind}`}>
                        {kind === 'established' ? <><CircleCheck size={11} /> Muito provável</> : <><Hourglass size={11} /> Provável</>}
                    </span>
                </div>
                <div className="rec-context">{rec.context}</div>
            </div>
            <span className="rec-qty">x{rec.recommendedQty}</span>
            <span className="rec-score">{Math.round(rec.score * 100)}%</span>
        </div>
    );
}
