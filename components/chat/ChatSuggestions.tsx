'use client';

import { defaultSuggestions } from '@/lib/chat/prompts';
import { Sparkles } from 'lucide-react';

interface ChatSuggestionsProps {
    onSelect: (message: string) => void;
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
            </div>

            <h3 className="text-lg font-medium text-gray-800 mb-2">
                AIアカウンタント
            </h3>

            <p className="text-sm text-gray-500 text-center mb-6">
                財務データについて何でも聞いてください
            </p>

            <div className="w-full space-y-2">
                <p className="text-xs text-gray-400 mb-2">よくある質問:</p>
                {defaultSuggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onSelect(suggestion)}
                        className="w-full text-left px-4 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        </div>
    );
}
