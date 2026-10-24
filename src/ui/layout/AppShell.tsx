'use client';

import {
    ChartColumn, CircleAlert, Cloud, Download, EllipsisVertical, LoaderCircle, LogOut, Boxes,
    ShoppingBasket, Upload, X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { createBackup } from '@/domain/backup';
import { toIsoDate } from '@/domain/text';
import { signOut } from '@/services/authActions';
import { restoreBackup } from '@/services/stateActions';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { downloadJson, readJsonFile } from '@/ui/lib/files';
import { useSaveStatus, useStore } from '@/ui/store/AppStoreProvider';

const NAV = [
    { href: '/lista', label: 'Minha Lista', icon: ShoppingBasket },
    { href: '/catalogo', label: 'Catálogo', icon: Boxes },
    { href: '/relatorios', label: 'Relatórios', icon: ChartColumn },
];

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="app">
            <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
                <div className="brand">
                    <h1>Minha Lista</h1>
                    <p>Sua compra inteligente</p>
                </div>
                <button type="button" className="icon-btn sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
                    <X size={20} />
                </button>
                <nav className="sidebar-nav" aria-label="Navegação principal">
                    {NAV.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`}>
                            <Icon size={18} /> {label}
                        </Link>
                    ))}
                </nav>
                <DataSection email={email} onDone={() => setMenuOpen(false)} />
            </aside>
            {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}

            <header className="mobile-header">
                <span className="brand-inline">Minha Lista</span>
                <SaveIndicator />
                <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
                    <EllipsisVertical size={22} />
                </button>
            </header>

            <main className="main">
                <SaveErrorBanner />
                {children}
            </main>

            <nav className="bottom-nav" aria-label="Navegação">
                {NAV.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} className={`bottom-nav-link ${pathname === href ? 'active' : ''}`}>
                        <Icon size={20} />
                        <span>{label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
}

function DataSection({ email, onDone }: { email: string; onDone: () => void }) {
    const store = useStore();
    const fileInput = useRef<HTMLInputElement>(null);
    const [pendingBackup, setPendingBackup] = useState<unknown>(null);
    const [message, setMessage] = useState('');

    async function handleExport() {
        await store.flush();
        const now = new Date();
        downloadJson(createBackup(store.getState(), now), `minha_lista_${toIsoDate(now)}.json`);
        onDone();
    }

    async function handleFile(file: File | undefined) {
        if (!file) return;
        const raw = await readJsonFile(file);
        if (raw === null) setMessage('Arquivo inválido.');
        else setPendingBackup(raw);
    }

    async function confirmRestore() {
        const raw = pendingBackup;
        setPendingBackup(null);
        setMessage('Restaurando...');
        await store.flush();
        const result = await restoreBackup(raw);
        if (result.ok) {
            store.replaceState(result.data);
            setMessage(`Backup restaurado: ${result.data.products.length} produtos.`);
            onDone();
        } else {
            setMessage(result.error);
        }
    }

    return (
        <div className="sidebar-footer">
            <span className="nav-section-title">Dados</span>
            <div className="account">
                <Cloud size={16} aria-hidden />
                <span title={email}>{email}</span>
                <SaveIndicator />
            </div>
            <button type="button" className="side-btn" onClick={handleExport}>
                <Download size={16} /> Exportar backup
            </button>
            <button type="button" className="side-btn" onClick={() => fileInput.current?.click()}>
                <Upload size={16} /> Importar backup
            </button>
            <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={event => { handleFile(event.target.files?.[0]); event.target.value = ''; }}
            />
            {message && <p className="side-message">{message}</p>}
            <form action={signOut}>
                <button type="submit" className="side-btn ghost"><LogOut size={16} /> Sair</button>
            </form>

            {pendingBackup !== null && (
                <ConfirmDialog
                    title="Importar backup"
                    message="Todos os seus dados atuais (produtos, ciclos e histórico) serão substituídos pelo conteúdo do arquivo. Deseja continuar?"
                    confirmLabel="Substituir dados"
                    onConfirm={confirmRestore}
                    onCancel={() => setPendingBackup(null)}
                />
            )}
        </div>
    );
}

function SaveIndicator() {
    const { status } = useSaveStatus();
    if (status === 'saving') return <LoaderCircle size={16} className="spin save-indicator" aria-label="Salvando" />;
    if (status === 'error') return <CircleAlert size={16} className="save-indicator error" aria-label="Erro ao salvar" />;
    return null;
}

function SaveErrorBanner() {
    const { status, error, dismiss } = useSaveStatus();
    if (status !== 'error') return null;
    return (
        <div className="banner banner-error" role="alert">
            <CircleAlert size={18} />
            <span>Não foi possível salvar. {error}</span>
            <button type="button" className="icon-btn" onClick={dismiss} aria-label="Fechar aviso"><X size={16} /></button>
        </div>
    );
}
