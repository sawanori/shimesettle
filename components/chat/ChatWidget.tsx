'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { ChatContainer } from './ChatContainer';

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* チャットコンテナ */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 z-50 w-96 h-[500px] shadow-2xl rounded-lg overflow-hidden border border-gray-200 bg-white md:w-96 max-md:inset-4 max-md:bottom-4 max-md:right-4 max-md:w-auto max-md:h-auto animate-in slide-in-from-bottom-10 fade-in duration-200">
                    <ChatContainer onClose={() => setIsOpen(false)} />
                </div>
            )}

            {/* トグルボタン */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-300"
                aria-label={isOpen ? 'チャットを閉じる' : 'チャットを開く'}
            >
                {isOpen ? (
                    <X className="w-6 h-6" />
                ) : (
                    <MessageCircle className="w-6 h-6" />
                )}
            </button>
        </>
    );
}
