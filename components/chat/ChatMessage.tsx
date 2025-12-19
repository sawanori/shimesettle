'use client';

import type { ChatMessage as ChatMessageType } from '@/lib/chat/types';
import { DataTable } from './DataTable';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
    message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* アバター */}
            <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-gray-200' : 'bg-blue-100'
                    }`}
            >
                {isUser ? (
                    <User className="w-4 h-4 text-gray-600" />
                ) : (
                    <Bot className="w-4 h-4 text-blue-600" />
                )}
            </div>

            {/* メッセージ本文 */}
            <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
            >
                {/* テキスト（改行を保持） */}
                <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                </div>

                {/* データテーブル（AIの回答にデータがある場合） */}
                {!isUser && message.data && message.data.type === 'table' && (
                    <div className="mt-3">
                        <DataTable data={message.data} />
                    </div>
                )}
            </div>
        </div>
    );
}
