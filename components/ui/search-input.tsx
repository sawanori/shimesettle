'use client';

import { useState, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

/**
 * IME対応の検索入力コンポーネント
 * 日本語入力（IME変換中）でも正しく動作します
 */
export function SearchInput({ placeholder, value, onChange, className = '' }: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value);
    const isComposingRef = useRef(false);

    // IME変換開始
    const handleCompositionStart = useCallback(() => {
        isComposingRef.current = true;
    }, []);

    // IME変換終了
    const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
        isComposingRef.current = false;
        // 変換確定時に親に通知
        onChange(e.currentTarget.value);
    }, [onChange]);

    // 入力変更
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        // IME変換中でなければ即座に親に通知
        if (!isComposingRef.current) {
            onChange(newValue);
        }
    }, [onChange]);

    // 外部からvalueが変更された場合に同期
    if (value !== localValue && !isComposingRef.current) {
        setLocalValue(value);
    }

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
                type="text"
                placeholder={placeholder}
                value={localValue}
                onChange={handleChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                className="w-full pl-8 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
        </div>
    );
}
