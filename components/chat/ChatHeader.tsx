'use client';

import { X, Trash2 } from 'lucide-react';

interface ChatHeaderProps {
    onClose: () => void;
    onClear: () => void;
}

export function ChatHeader({ onClose, onClear }: ChatHeaderProps) {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-sm font-bold">AI</span>
                </div>
                <span className="font-medium">AIアカウンタント</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={onClear}
                    className="p-1.5 hover:bg-white/20 rounded transition-colors"
                    aria-label="履歴をクリア"
                    title="履歴をクリア"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/20 rounded transition-colors"
                    aria-label="閉じる"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
