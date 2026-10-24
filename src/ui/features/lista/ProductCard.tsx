'use client';

import { Check, RefreshCw, ShoppingBasket, ShoppingCart, Star } from 'lucide-react';
import { cycleLabel, frequencyPercent } from '@/domain/pattern';
import type { Product } from '@/domain/types';
import { QuantityStepper } from './QuantityStepper';

interface ProductCardProps {
    product: Product;
    showFrequency: boolean;
    recommended: boolean;
    recent: boolean;
    onToggle: (productId: number) => void;
    onQuantity: (productId: number, quantity: number) => void;
}

export function ProductCard(
    { product, showFrequency, recommended, recent, onToggle, onQuantity }: ProductCardProps,
) {
    const pp = product.pattern;
    const freqPct = frequencyPercent(product);
    const established = pp.confidencePhase === 'established' && !pp.patternBroken;

    return (
        <article
            className={`product-card ${product.selected ? 'selected' : ''} ${product.imageUrl ? 'has-img' : ''}`}
            style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}
        >
            <button
                type="button"
                className="product-card-hit"
                onClick={() => onToggle(product.id)}
                aria-pressed={product.selected}
                aria-label={`${product.selected ? 'Remover' : 'Adicionar'} ${product.name}`}
            />
            <span className="card-check" aria-hidden><Check size={16} /></span>
            {(recommended && established) || recent ? (
                <div className="card-badges">
                    {recommended && established && <span className="badge badge-rec"><Star size={12} /> Recomendado</span>}
                    {recent && <span className="badge badge-recent"><ShoppingCart size={12} /> Recente</span>}
                </div>
            ) : null}
            {!product.imageUrl && <span className="card-placeholder" aria-hidden><ShoppingBasket size={34} /></span>}

            <div className="card-band">
                <div className="card-name-group">
                    <span className="card-name">{product.name}</span>
                    {showFrequency && freqPct > 0 && (
                        <>
                            <span className="card-freq">
                                <RefreshCw size={11} /> {freqPct}%
                                {established && pp.avgIntervalCycles > 0 && <> · {cycleLabel(pp)}</>}
                            </span>
                            <span className="bar"><span className="bar-fill" style={{ width: `${freqPct}%` }} /></span>
                        </>
                    )}
                </div>
                {product.selected && (
                    <QuantityStepper value={product.quantity} onChange={q => onQuantity(product.id, q)} />
                )}
            </div>
        </article>
    );
}
