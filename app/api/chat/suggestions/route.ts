import { NextResponse } from 'next/server';
import { defaultSuggestions } from '@/lib/chat/prompts';

export async function GET() {
    // 将来的にはユーザーの使用履歴に基づいて
    // パーソナライズされたサジェストを返す
    return NextResponse.json({
        suggestions: defaultSuggestions,
    });
}
