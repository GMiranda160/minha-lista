'use client';

import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

/** Botões - e + com campo numérico. Chegar a zero remove o item da lista. */
export function QuantityStepper({ value, onChange }: { value: number; onChange: (quantity: number) => void }) {
    const [draft, setDraft] = useState<string | null>(null);

    const commit = () => {
        if (draft === null) return;
        onChange(parseInt(draft, 10) || 0);
        setDraft(null);
    };

    return (
        <div className="stepper">
            <button type="button" onClick={() => onChange(value - 1)} aria-label="Diminuir quantidade"><Minus size={14} /></button>
            <input
                type="number"
                inputMode="numeric"
                min={1}
                value={draft ?? value}
                onChange={event => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={event => { if (event.key === 'Enter') commit(); }}
                onFocus={event => event.target.select()}
                aria-label="Quantidade"
            />
            <button type="button" onClick={() => onChange(value + 1)} aria-label="Aumentar quantidade"><Plus size={14} /></button>
        </div>
    );
}
