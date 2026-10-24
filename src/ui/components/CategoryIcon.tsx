import { Box, Package, Snowflake, Sparkles, SprayCan, Tag, type LucideIcon } from 'lucide-react';
import type { Category } from '@/domain/types';

const ICONS: Record<Category, LucideIcon> = {
    geladeira: Snowflake,
    freezer: Box,
    armarios: Package,
    limpeza: SprayCan,
    higiene: Sparkles,
    outros: Tag,
};

export function CategoryIcon({ category, size = 18 }: { category: Category; size?: number }) {
    const Icon = ICONS[category];
    return <Icon size={size} aria-hidden />;
}
