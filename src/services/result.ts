/* Resultado padrão das ações do servidor: a tela nunca recebe exceção crua. */

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export async function runAction<T>(task: () => Promise<T>): Promise<ActionResult<T>> {
    try {
        return { ok: true, data: await task() };
    } catch (err) {
        console.error(err);
        return { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado.' };
    }
}
