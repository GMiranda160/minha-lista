import {
    Apple, Baby, Bath, Beef, Box, Candy, Carrot, Cat, Coffee, Cookie, Croissant, CupSoda, Dog, Drumstick,
    Egg, Fish, House, Leaf, Milk, Package, Pill, Shapes, Shirt, ShoppingBasket, Snowflake, Sparkles,
    SprayCan, Tag, Wheat, Wine, type LucideIcon,
} from 'lucide-react';
import type { CATEGORY_ICONS } from '@/domain/constants';

/** Desenho de cada chave de ícone oferecida no domínio (CATEGORY_ICONS). */
const ICONS: Record<typeof CATEGORY_ICONS[number], LucideIcon> = {
    snowflake: Snowflake, box: Box, package: Package, 'spray-can': SprayCan, sparkles: Sparkles, tag: Tag,
    apple: Apple, carrot: Carrot, beef: Beef, fish: Fish, drumstick: Drumstick, egg: Egg,
    milk: Milk, croissant: Croissant, wheat: Wheat, cookie: Cookie, candy: Candy, coffee: Coffee,
    'cup-soda': CupSoda, wine: Wine, pill: Pill, bath: Bath, baby: Baby, dog: Dog,
    cat: Cat, shirt: Shirt, house: House, leaf: Leaf, 'shopping-basket': ShoppingBasket, shapes: Shapes,
};

export function CategoryIcon({ icon, size = 18 }: { icon: string; size?: number }) {
    const Icon = ICONS[icon as keyof typeof ICONS] ?? Tag;
    return <Icon size={size} aria-hidden />;
}
