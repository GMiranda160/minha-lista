/* Baixar e abrir arquivos JSON no navegador. */

export function downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/** Lê o arquivo escolhido em um <input type="file">; null se não for JSON válido. */
export async function readJsonFile(file: File): Promise<unknown | null> {
    try {
        return JSON.parse(await file.text());
    } catch {
        return null;
    }
}
