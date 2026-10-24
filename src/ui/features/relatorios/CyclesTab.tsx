'use client';

import { Download, FileText, FileUp, MousePointerClick, Printer } from 'lucide-react';
import { useRef, useState } from 'react';
import { createCycleExport } from '@/domain/backup';
import { deleteCycle, getAllCycles } from '@/domain/cycles';
import { compareNames, formatDate, plural } from '@/domain/text';
import type { AppState, Cycle } from '@/domain/types';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { EmptyState } from '@/ui/components/EmptyState';
import { PrintPreviewModal } from '@/ui/components/PrintPreviewModal';
import { downloadJson } from '@/ui/lib/files';
import { openPrintWindow } from '@/ui/lib/print';
import { useStore } from '@/ui/store/AppStoreProvider';
import { CycleDetail } from './CycleDetail';
import { useCycleImport } from './useCycleImport';

const cycleItems = (cycle: Cycle) =>
    cycle.items
        .map(i => ({ name: i.productName, quantity: i.quantity }))
        .sort((a, b) => compareNames(a.name, b.name));

export function CyclesTab({ state }: { state: AppState }) {
    const store = useStore();
    const cycles = getAllCycles(state);
    const [selected, setSelected] = useState<number | null>(null);
    const [printing, setPrinting] = useState<Cycle | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const cycleImport = useCycleImport();

    const selectedCycle = cycles.find(c => c.number === selected);
    const totalItems = cycles.reduce((sum, c) => sum + c.items.length, 0);

    const exportCycle = (cycle: Cycle) =>
        downloadJson(createCycleExport(state, cycle), `ciclo_${cycle.number}_${cycle.date}.json`);

    function confirmDelete() {
        if (deleting === null) return;
        store.apply(s => deleteCycle(s, deleting));
        if (selected === deleting) setSelected(null);
        setDeleting(null);
    }

    const importButton = (
        <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()}>
            <FileUp size={16} /> Importar ciclo
        </button>
    );

    return (
        <>
            <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) cycleImport.startImport(file);
                    event.target.value = '';
                }}
            />
            {cycleImport.error && <p className="form-error">{cycleImport.error}</p>}

            <div className="metric-row">
                <div className="metric"><strong className="metric-value">{cycles.length}</strong><span className="metric-note">ciclos registrados</span></div>
                <div className="metric"><strong className="metric-value">{totalItems}</strong><span className="metric-note">itens no total</span></div>
                <div className="metric"><strong className="metric-value">#{state.totalCycles}</strong><span className="metric-note">último ciclo</span></div>
                <div className="metric metric-action">{importButton}</div>
            </div>

            {cycles.length === 0 ? (
                <EmptyState icon={FileText} title="Nenhum ciclo encontrado">
                    Imprima sua primeira lista para criar o ciclo #1, ou importe um ciclo exportado.
                </EmptyState>
            ) : (
                <div className="cycle-grid">
                    {cycles.map(cycle => (
                        <div
                            key={cycle.number}
                            className={`cycle-card ${selected === cycle.number ? 'selected' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelected(selected === cycle.number ? null : cycle.number)}
                            onKeyDown={e => { if (e.key === 'Enter') setSelected(cycle.number); }}
                        >
                            <div className="cycle-card-actions">
                                <button type="button" className="icon-btn" title="Exportar ciclo (.json)"
                                    onClick={e => { e.stopPropagation(); exportCycle(cycle); }}>
                                    <Download size={14} />
                                </button>
                                <button type="button" className="icon-btn" title="Imprimir ciclo (não cria um ciclo novo)"
                                    onClick={e => { e.stopPropagation(); setPrinting(cycle); }}>
                                    <Printer size={14} />
                                </button>
                            </div>
                            <FileText size={22} className="cycle-card-icon" />
                            <strong>Ciclo #{cycle.number}</strong>
                            <span className="muted">{formatDate(cycle.date)}</span>
                            <span className="pill">{cycle.items.length} {plural(cycle.items.length, 'item', 'itens')}</span>
                        </div>
                    ))}
                </div>
            )}

            {selectedCycle ? (
                <CycleDetail
                    key={selectedCycle.number}
                    state={state}
                    cycle={selectedCycle}
                    onPrint={() => setPrinting(selectedCycle)}
                    onExport={() => exportCycle(selectedCycle)}
                    onDelete={() => setDeleting(selectedCycle.number)}
                    onClose={() => setSelected(null)}
                />
            ) : cycles.length > 0 && (
                <div className="hint-box"><MousePointerClick size={20} /> Clique em um ciclo acima para ver os detalhes</div>
            )}

            {printing && (
                <PrintPreviewModal
                    title={`Ciclo #${printing.number}: ${formatDate(printing.date)}`}
                    heading={formatDate(printing.date)}
                    items={cycleItems(printing)}
                    confirmLabel="Imprimir"
                    onConfirm={() => { openPrintWindow(formatDate(printing.date), cycleItems(printing)); setPrinting(null); }}
                    onClose={() => setPrinting(null)}
                />
            )}
            {deleting !== null && (
                <ConfirmDialog
                    title="Excluir ciclo"
                    message={<>Excluir permanentemente o <strong>Ciclo #{deleting}</strong>? Os itens dele serão removidos e os ciclos restantes serão renumerados.</>}
                    confirmLabel="Excluir"
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
            {cycleImport.dialog}
        </>
    );
}
