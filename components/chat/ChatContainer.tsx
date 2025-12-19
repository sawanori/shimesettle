'use client';

import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ChatSuggestions } from './ChatSuggestions';
import { useChatMessages } from '@/hooks/useChatMessages';

interface ChatContainerProps {
    onClose: () => void;
}

export function ChatContainer({ onClose }: ChatContainerProps) {
    const {
        messages,
        isLoading,
        error,
        sendMessage,
        clearHistory,
    } = useChatMessages();

    const showSuggestions = messages.length === 0;

    return (
        <div className="flex flex-col h-full bg-white">
            <ChatHeader onClose={onClose} onClear={clearHistory} />

            <div className="flex-1 overflow-hidden relative">
                {showSuggestions ? (
                    <ChatSuggestions onSelect={sendMessage} />
                ) : (
                    <ChatMessages messages={messages} isLoading={isLoading} />
                )}
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-t border-red-100">
                    {error}
                </div>
            )}

            <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
    );
}
