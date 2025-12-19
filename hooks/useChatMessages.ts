'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ChatMessage, ChatResponse } from '@/lib/chat/types';

const STORAGE_KEY = 'shimesettle-chat-history';
const MAX_STORED_MESSAGES = 50;

interface StoredChatState {
    messages: ChatMessage[];
    conversationId: string | null;
}

// localStorageから状態を読み込み
function loadFromStorage(): StoredChatState {
    if (typeof window === 'undefined') {
        return { messages: [], conversationId: null };
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // パースエラーの場合は無視
    }

    return { messages: [], conversationId: null };
}

// localStorageに状態を保存
function saveToStorage(state: StoredChatState): void {
    if (typeof window === 'undefined') return;

    try {
        // 最新のN件のみ保存
        const trimmedMessages = state.messages.slice(-MAX_STORED_MESSAGES);
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                messages: trimmedMessages,
                conversationId: state.conversationId,
            })
        );
    } catch {
        // ストレージエラーは無視
    }
}

interface UseChatMessagesReturn {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    conversationId: string | null;
    sendMessage: (message: string) => Promise<void>;
    clearHistory: () => void;
}

export function useChatMessages(): UseChatMessagesReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // 初期化時にlocalStorageから読み込み
    useEffect(() => {
        const stored = loadFromStorage();
        setMessages(stored.messages);
        setConversationId(stored.conversationId);
        setIsInitialized(true);
    }, []);

    // 状態変更時にlocalStorageに保存
    useEffect(() => {
        if (isInitialized) {
            saveToStorage({ messages, conversationId });
        }
    }, [messages, conversationId, isInitialized]);

    const sendMessage = useCallback(
        async (message: string) => {
            setError(null);
            setIsLoading(true);

            // ユーザーメッセージを即座に追加（楽観的更新）
            const userMessage: ChatMessage = {
                id: `user-${Date.now()}`,
                role: 'user',
                content: message,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, userMessage]);

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message,
                        conversationId,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = errorData.details
                        ? `${errorData.error}: ${errorData.details}`
                        : errorData.error || 'エラーが発生しました';
                    throw new Error(errorMessage);
                }

                const data: ChatResponse = await response.json();

                // AIの回答を追加
                setMessages((prev) => [...prev, data.message]);
                setConversationId(data.conversationId);
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : 'エラーが発生しました';
                setError(errorMessage);

                // エラー時はユーザーメッセージを削除
                setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
            } finally {
                setIsLoading(false);
            }
        },
        [conversationId]
    );

    const clearHistory = useCallback(() => {
        setMessages([]);
        setConversationId(null);
        setError(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return {
        messages,
        isLoading,
        error,
        conversationId,
        sendMessage,
        clearHistory,
    };
}
