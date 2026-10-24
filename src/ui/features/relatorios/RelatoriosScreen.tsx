'use client';

import { Box, ChartLine, ClockArrowUp, Microscope, Search } from 'lucide-react';
import { useState } from 'react';
import { DECAY_INTERVAL } from '@/domain/constants';
import { EmptyState } from '@/ui/components/EmptyState';
import { PageHeader } from '@/ui/components/PageHeader';
import { useAppState } from '@/ui/store/AppStoreProvider';
import { CyclesTab } from './CyclesTab';
import { DataTab } from './DataTab';
import { OverviewTab } from './OverviewTab';
import { ProductTab } from './ProductTab';

const TABS = [
    { id: 'overview', label: 'Análise de produtos', icon: Box },
    { id: 'product', label: 'Por produto', icon: Search },
    { id: 'data', label: 'Análise de dados', icon: Microscope },
    { id: 'cycles', label: 'Ciclos', icon: ClockArrowUp },
] as const;

type TabId = typeof TABS[number]['id'];

export function RelatoriosScreen() {
    const state = useAppState();
    const [tab, setTab] = useState<TabId>('overview');

    const subtitle = tab === 'cycles'
        ? `${state.totalCycles} listas · Visualize, edite ou exclua ciclos de compras`
        : `${state.totalCycles} listas · Ciclo atual: #${state.totalCycles} · Decaimento a cada ${DECAY_INTERVAL} listas`;

    return (
        <div className="page">
            <PageHeader title="Relatórios e padrões" subtitle={subtitle} />
            {state.totalCycles === 0 && tab !== 'cycles' ? (
                <>
                    <EmptyState icon={ChartLine} title="Sem dados suficientes">
                        Imprima pelo menos uma lista para começar a gerar relatórios.
                    </EmptyState>
                    <div className="center">
                        <button type="button" className="btn btn-outline" onClick={() => setTab('cycles')}>
                            <ClockArrowUp size={16} /> Importar um ciclo
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="tabs" role="tablist">
                        {TABS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={tab === id}
                                className={`tab ${tab === id ? 'active' : ''}`}
                                onClick={() => setTab(id)}
                            >
                                <Icon size={16} /> {label}
                            </button>
                        ))}
                    </div>
                    {tab === 'overview' && <OverviewTab state={state} />}
                    {tab === 'product' && <ProductTab state={state} />}
                    {tab === 'data' && <DataTab state={state} />}
                    {tab === 'cycles' && <CyclesTab state={state} />}
                </>
            )}
        </div>
    );
}
