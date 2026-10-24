/* =================================================================
   Store do cliente. Aplica uma operação do domínio, atualiza a tela
   na hora (otimista) e grava só as diferenças, em fila, no servidor.
   ================================================================= */

import { diffState } from '@/domain/changes';
import type { AppState } from '@/domain/types';
import { fetchState, saveChanges } from '@/services/stateActions';

type Listener = () => void;

export type SaveStatus = 'idle' | 'saving' | 'error';

export class AppStore {
    private state: AppState;
    private saveStatus: SaveStatus = 'idle';
    private errorMessage = '';
    private queue: Promise<void> = Promise.resolve();
    private pending = 0;
    private listeners = new Set<Listener>();

    constructor(initial: AppState) {
        this.state = initial;
    }

    getState = () => this.state;

    getSaveStatus = () => this.saveStatus;

    getErrorMessage = () => this.errorMessage;

    subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    /** Aplica uma operação pura do domínio e agenda a gravação do que mudou. */
    apply = (operation: (state: AppState) => AppState): AppState => {
        const before = this.state;
        const after = operation(before);
        if (after === before) return after;
        this.state = after;
        this.emit();

        const changes = diffState(before, after);
        if (changes) this.enqueue(async () => {
            const result = await saveChanges(changes);
            if (!result.ok) throw new Error(result.error);
        });
        return after;
    };

    /**
     * Aplica uma operação cujo resultado já está gravado no servidor
     * (ex.: incluir o produto ou a categoria recém-criados). Não gera gravação.
     */
    applySaved = (operation: (state: AppState) => AppState) => {
        this.state = operation(this.state);
        this.emit();
    };

    /** Troca todo o estado por um vindo do servidor (ex.: backup restaurado). */
    replaceState = (state: AppState) => {
        this.state = state;
        this.emit();
    };

    /** Espera as gravações pendentes terminarem. */
    flush = () => this.queue;

    dismissError = () => {
        this.saveStatus = 'idle';
        this.errorMessage = '';
        this.emit();
    };

    private enqueue(task: () => Promise<void>) {
        this.pending++;
        this.setStatus('saving');
        this.queue = this.queue
            .then(task)
            .then(() => {
                this.pending--;
                if (this.pending === 0 && this.saveStatus === 'saving') this.setStatus('idle');
            })
            .catch(async (err: unknown) => {
                this.pending--;
                this.errorMessage = err instanceof Error ? err.message : 'Falha ao salvar.';
                this.setStatus('error');
                await this.reloadFromServer();
            });
    }

    /** Após uma falha, volta para o que está de fato salvo no banco. */
    private async reloadFromServer() {
        const result = await fetchState();
        if (result.ok) this.replaceState(result.data);
    }

    private setStatus(status: SaveStatus) {
        this.saveStatus = status;
        this.emit();
    }

    private emit() {
        this.listeners.forEach(listener => listener());
    }
}
