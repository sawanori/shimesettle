'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [value, setValue] = useState('');
    const isComposingRef = useRef(false);

    // IME変換開始
    const handleCompositionStart = useCallback(() => {
        isComposingRef.current = true;
    }, []);

    // IME変換終了
    const handleCompositionEnd = useCallback(() => {
        isComposingRef.current = false;
    }, []);

    // メッセージ送信
    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (trimmed && !disabled) {
            onSend(trimmed);
            setValue('');
        }
    }, [value, disabled, onSend]);

    // キーボードイベント
    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            // IME変換中は無視
            if (isComposingRef.current) return;

            // Enter で送信（Shift+Enter は改行）
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    return (
        <div className="border-t border-gray-200 p-3">
            <div className="flex items-end gap-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    placeholder="質問を入力..."
                    disabled={disabled}
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    style={{ maxHeight: '120px' }}
                />
                <button
                    onClick={handleSend}
                    disabled={disabled || !value.trim()}
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    aria-label="送信"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
                Enter で送信 / Shift+Enter で改行
            </p>
        </div>
    );
}
