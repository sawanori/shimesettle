import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createErrorResponse } from '@/lib/chat/errors';

/**
 * GET /api/chat/history - 会話履歴を取得
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (conversationId) {
      // 特定の会話のメッセージを取得
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (!conversation) {
        return createErrorResponse('UNAUTHORIZED', '会話が見つかりません');
      }

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, data, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return NextResponse.json({
        conversationId,
        messages: messages?.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          data: m.data,
          timestamp: m.created_at,
        })) || [],
      });
    }

    // 会話一覧を取得
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        title,
        updated_at,
        chat_messages (
          id,
          role,
          content,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // 最新メッセージのみを含む形式に変換
    const formattedConversations = conversations?.map(conv => ({
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updated_at,
      lastMessage: conv.chat_messages?.[0]?.content || '',
      messageCount: conv.chat_messages?.length || 0,
    })) || [];

    return NextResponse.json({
      conversations: formattedConversations,
    });

  } catch (error) {
    console.error('Chat history error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}

/**
 * DELETE /api/chat/history - 会話履歴を削除
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // 特定の会話を削除
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: '会話を削除しました',
      });
    }

    // 全会話を削除
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '全ての会話履歴を削除しました',
    });

  } catch (error) {
    console.error('Chat history delete error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}
