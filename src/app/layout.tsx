import type { Metadata, Viewport } from 'next';
import { Pacifico, Quicksand } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-body' });
const pacifico = Pacifico({ subsets: ['latin'], weight: '400', variable: '--font-brand' });

export const metadata: Metadata = {
    title: 'Minha Lista',
    description: 'Lista de compras inteligente com recomendações pelos seus ciclos de compra.',
};

export const viewport: Viewport = {
    themeColor: '#0d9488',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-BR" className={`${quicksand.variable} ${pacifico.variable}`}>
            <body>{children}</body>
        </html>
    );
}
