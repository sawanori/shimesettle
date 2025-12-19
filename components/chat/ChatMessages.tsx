'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/lib/chat/types';
import { Loader2 } from 'lucide-react';

interface ChatMessagesProps {
    messages: ChatMessageType[];
    isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // 新しいメッセージが追加されたら自動スクロール
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
            ))}

            {isLoading && (
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">考え中...</span>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
