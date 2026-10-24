import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    experimental: {
        /* Restaurar backup envia o arquivo inteiro para o servidor. */
        serverActions: { bodySizeLimit: '5mb' },
    },
};

export default nextConfig;
