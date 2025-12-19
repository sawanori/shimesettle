import { createClient } from '@/utils/supabase/server';

// レート制限の設定
const RATE_LIMIT_REQUESTS = 30;  // 最大リクエスト数
const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1分間

// インメモリキャッシュ（サーバーレス環境では各リクエストでリセットされる可能性あり）
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

/**
 * インメモリでのレート制限チェック（高速）
 */
function checkInMemoryRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const cached = rateLimitCache.get(userId);

  if (!cached || now > cached.resetTime) {
    // キャッシュがないか期限切れの場合、新しいエントリを作成
    rateLimitCache.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (cached.count >= RATE_LIMIT_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: cached.resetTime - now,
    };
  }

  cached.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_REQUESTS - cached.count,
    resetIn: cached.resetTime - now,
  };
}

/**
 * データベースでの使用量追跡（永続化）
 */
export async function trackUsage(userId: string, tokensUsed: number = 0): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // UPSERT: 存在すればカウントを増やし、なければ新規作成
  const { error } = await supabase.rpc('increment_chat_usage', {
    p_user_id: userId,
    p_date: today,
    p_tokens: tokensUsed,
  });

  // RPC関数がない場合はフォールバック
  if (error) {
    // 既存レコードを取得
    const { data: existing } = await supabase
      .from('chat_usage')
      .select('id, request_count, tokens_used')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      // 更新
      await supabase
        .from('chat_usage')
        .update({
          request_count: (existing.request_count ?? 0) + 1,
          tokens_used: (existing.tokens_used ?? 0) + tokensUsed,
        })
        .eq('id', existing.id);
    } else {
      // 新規作成
      await supabase
        .from('chat_usage')
        .insert({
          user_id: userId,
          date: today,
          request_count: 1,
          tokens_used: tokensUsed,
        });
    }
  }
}

/**
 * レート制限チェック（メイン関数）
 */
export function checkChatRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  return checkInMemoryRateLimit(userId);
}

/**
 * レート制限ヘッダーを生成
 */
export function getRateLimitHeaders(remaining: number, resetIn: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_REQUESTS),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetIn / 1000)),
  };
}
