import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { validateChatRequest } from '@/lib/chat/schemas';
import { createErrorResponse, handleApiError } from '@/lib/chat/errors';
import { checkChatRateLimit, getRateLimitHeaders, trackUsage } from '@/lib/chat/rateLimit';
import { classifyIntent, classifyAction } from '@/lib/chat/intentClassifier';
import { FinancialQueryBuilder } from '@/lib/chat/queryBuilder';
import { generateResponse } from '@/lib/chat/responseGenerator';
import { ActionExecutor } from '@/lib/chat/actionExecutor';
import type { ChatResponse, ChatMessage, QueryResult } from '@/lib/chat/types';
import type { Json } from '@/types/supabase';

export async function POST(req: Request) {
  try {
    // 1. 認証チェック
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse('UNAUTHORIZED');
    }

    // 2. レート制限チェック
    const rateLimit = checkChatRateLimit(user.id);
    const rateLimitHeaders = getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'リクエスト制限に達しました。しばらく待ってから再度お試しください。',
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: rateLimitHeaders,
        }
      );
    }

    // 3. リクエストボディのパース・バリデーション
    const body = await req.json();
    console.log('[Chat API] Request body:', JSON.stringify(body));
    const validation = validateChatRequest(body);

    if (!validation.success) {
      console.log('[Chat API] Validation failed:', validation.error.issues);
      return createErrorResponse(
        'INVALID_QUERY',
        validation.error.issues.map(e => e.message).join(', ')
      );
    }

    const { message, conversationId, context } = validation.data;

    // 4. 会話の取得または作成
    let currentConversationId = conversationId;

    if (!currentConversationId) {
      // 新規会話を作成
      const { data: newConversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: message.substring(0, 50),  // 最初のメッセージから仮タイトルを設定
        })
        .select('id')
        .single();

      if (convError || !newConversation) {
        console.error('Failed to create conversation:', convError);
        return createErrorResponse('INTERNAL_ERROR');
      }

      currentConversationId = newConversation.id;
    } else {
      // 既存会話の所有者確認
      const { data: existingConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', currentConversationId)
        .eq('user_id', user.id)
        .single();

      if (!existingConv) {
        return createErrorResponse('UNAUTHORIZED', '会話が見つかりません');
      }
    }

    // 5. ユーザーメッセージを保存
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'user' as const,
        content: message,
      });

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError);
    }

    // 6. アクション分類（登録 or クエリの判定）
    const { actionIntent, tokensUsed: actionTokens } = await classifyAction(message);
    console.log('[Chat API] ActionIntent:', JSON.stringify(actionIntent, null, 2));

    let aiResponse: string;
    let queryResult: QueryResult | null = null;
    let totalTokensUsed = actionTokens;

    // 7. アクション実行 or クエリ実行
    if (
      actionIntent.action_type !== 'query' &&
      actionIntent.confidence >= 0.7
    ) {
      // 登録アクションを実行
      console.log('[Chat API] Executing action:', actionIntent.action_type);
      const actionExecutor = new ActionExecutor(supabase, user.id);
      const actionResult = await actionExecutor.execute(actionIntent);

      aiResponse = actionResult.message;

      // 成功時はサジェストを登録系にする
      const suggestions = actionResult.success
        ? getActionSuggestions(actionIntent.action_type)
        : getNextSuggestions('general');

      // AIメッセージを保存
      const { data: savedMessage, error: aiMsgError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversationId,
          role: 'assistant' as const,
          content: aiResponse,
          data: actionResult.data as unknown as Json,
          intent: actionIntent as unknown as Json,
          tokens_used: totalTokensUsed,
        })
        .select('id, created_at')
        .single();

      if (aiMsgError) {
        console.error('Failed to save AI message:', aiMsgError);
      }

      await trackUsage(user.id, totalTokensUsed);

      const responseMessage: ChatMessage = {
        id: savedMessage?.id || crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: savedMessage?.created_at || new Date().toISOString(),
      };

      const chatResponse: ChatResponse = {
        conversationId: currentConversationId,
        message: responseMessage,
        suggestions,
      };

      return NextResponse.json(chatResponse, {
        headers: rateLimitHeaders,
      });
    }

    // クエリ処理（既存フロー）
    const { intent, tokensUsed: intentTokens } = await classifyIntent(message, context);
    console.log('[Chat API] Intent:', JSON.stringify(intent, null, 2));
    totalTokensUsed += intentTokens;

    // 8. データ取得
    const queryBuilder = new FinancialQueryBuilder(supabase, user.id);
    queryResult = await queryBuilder.execute(intent);
    console.log('[Chat API] QueryResult:', JSON.stringify(queryResult, null, 2));

    // 9. 回答生成
    const { response: generatedResponse, tokensUsed: responseTokens } = await generateResponse(
      message,
      queryResult,
      intent
    );
    aiResponse = generatedResponse;
    totalTokensUsed += responseTokens;

    // 10. AIメッセージを保存
    const { data: savedMessage, error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'assistant' as const,
        content: aiResponse,
        data: queryResult as unknown as Json,
        intent: intent as unknown as Json,
        tokens_used: totalTokensUsed,
      })
      .select('id, created_at')
      .single();

    if (aiMsgError) {
      console.error('Failed to save AI message:', aiMsgError);
    }

    // 11. 使用量を追跡
    await trackUsage(user.id, totalTokensUsed);

    // 12. レスポンスを構築
    const responseMessage: ChatMessage = {
      id: savedMessage?.id || crypto.randomUUID(),
      role: 'assistant',
      content: aiResponse,
      data: queryResult.data.length > 0 ? queryResult : undefined,
      timestamp: savedMessage?.created_at || new Date().toISOString(),
    };

    const chatResponse: ChatResponse = {
      conversationId: currentConversationId,
      message: responseMessage,
      suggestions: getNextSuggestions(intent.query_type),
    };

    return NextResponse.json(chatResponse, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    console.error('[Chat API] Caught error:', error);
    return handleApiError(error);
  }
}

// 次の質問サジェストを生成
function getNextSuggestions(queryType: string): string[] {
  const baseSuggestions = [
    '今月の経費はいくら？',
    '未入金の売上を教えて',
    '今年度の収支サマリー',
  ];

  // クエリタイプに応じた追加サジェスト
  const contextualSuggestions: Record<string, string[]> = {
    expense_summary: ['勘定科目別の内訳を見せて', '前月と比較して'],
    sales_summary: ['チャネル別の売上', '未入金の売上リスト'],
    sales_unpaid: ['入金待ちの合計金額', '最も古い未入金は？'],
    profit_loss: ['部門別の損益', '前年度と比較'],
  };

  const additional = contextualSuggestions[queryType] || [];
  return [...additional, ...baseSuggestions].slice(0, 4);
}

// アクション実行後のサジェストを生成
function getActionSuggestions(actionType: string): string[] {
  if (actionType === 'register_expense') {
    return [
      '今月の経費合計は？',
      '勘定科目別の内訳を見せて',
      '別の経費を登録',
      '今年度の経費一覧',
    ];
  }

  if (actionType === 'register_sale') {
    return [
      '今月の売上合計は？',
      '未入金の売上リスト',
      '別の売上を登録',
      'チャネル別の売上',
    ];
  }

  return [
    '今月の経費はいくら？',
    '未入金の売上を教えて',
    '今年度の収支サマリー',
    '経費を登録したい',
  ];
}
