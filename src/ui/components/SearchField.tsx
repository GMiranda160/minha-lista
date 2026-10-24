'use client';

import { Search, X } from 'lucide-react';

interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
    return (
        <div className="search-field">
            <Search size={16} aria-hidden />
            <input
                type="search"
                value={value}
                onChange={event => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
            />
            {value && (
                <button type="button" className="icon-btn" onClick={() => onChange('')} aria-label="Limpar busca">
                    <X size={16} />
                </button>
            )}
        </div>
    );
}
