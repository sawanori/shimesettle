import { OpenAI } from 'openai';
import { getCurrentFiscalYear, getFiscalYearRange } from '@/lib/fiscalYear';
import { QueryIntentSchema, ActionIntentSchema } from './schemas';
import type { QueryIntent, ActionIntent } from './types';
import type { Department } from '@/types/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 現在の日付を取得
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// 意図解析用プロンプトを生成
function getIntentClassificationPrompt(): string {
  const currentDate = getCurrentDate();
  const fiscalYear = getCurrentFiscalYear();
  const fiscalRange = getFiscalYearRange(fiscalYear);

  return `あなたは財務データクエリの意図解析AIです。
ユーザーの質問から、以下の情報をJSON形式で抽出してください。

## 出力形式（必ずこのJSON形式のみを出力）
{
  "query_type": "expense_summary | expense_detail | expense_by_category | expense_by_department | sales_summary | sales_detail | sales_by_channel | sales_by_department | sales_unpaid | bank_balance | bank_transactions | cashflow_summary | profit_loss | comparison | general | unknown",
  "time_range": {
    "type": "current_month | last_month | current_fiscal_year | custom | all",
    "start_date": "YYYY-MM-DD または null",
    "end_date": "YYYY-MM-DD または null"
  },
  "filters": {
    "department": "PHOTO | VIDEO | WEB | COMMON または null",
    "account_item": "勘定科目名 または null",
    "channel": "DIRECT | REFERRAL | SNS | WEBSITE | PLATFORM_KURASHI | PLATFORM_TOTTA | REPEAT | OTHER または null",
    "status": "PAID | UNPAID または null",
    "bank_account_id": null
  },
  "aggregation": {
    "group_by": "department | account_item | channel | month または null",
    "sort_by": "amount | date または null",
    "sort_order": "asc | desc または null",
    "limit": null
  },
  "comparison": {
    "enabled": false,
    "compare_to": null
  }
}

## クエリタイプの判定ルール
- 「経費」「出費」「支出」「いくら使った」→ expense系
- 「売上」「収入」「売り上げ」→ sales系
- 「未入金」「未払い」「入金待ち」→ sales_unpaid
- 「残高」「口座」「銀行」→ bank_balance
- 「収支」「利益」「損益」「儲け」→ profit_loss
- 「比較」「前月比」「前年比」→ comparison
- 「内訳」「科目別」「カテゴリ別」→ *_by_category
- 「部門別」→ *_by_department
- 「チャネル別」「経路別」→ sales_by_channel
- 「合計」「トータル」「総額」→ *_summary

## 時間表現の解釈ルール
- 「今月」→ type: current_month
- 「先月」「前月」→ type: last_month
- 「今年度」「今期」「年度」→ type: current_fiscal_year
- 「去年」「昨年」→ custom（前年の1月〜12月を設定）
- 「〇月」「〇月分」→ custom（当年の該当月を設定）
- 時間指定なし → type: current_fiscal_year（デフォルト）

## 部門の判定ルール
- 「写真」「撮影」「カメラ」「フォト」→ PHOTO
- 「動画」「映像」「ビデオ」「ムービー」→ VIDEO
- 「Web」「ウェブ」「サイト」「ホームページ」→ WEB
- 「共通」「全体」「その他」「会社」→ COMMON

## 勘定科目の例
旅費交通費、消耗品費、通信費、外注費、接待交際費、広告宣伝費、地代家賃、水道光熱費、支払手数料、雑費

## 現在の情報
- 今日の日付: ${currentDate}
- 現在の会計年度: ${fiscalYear}年度
- 会計年度の期間: ${fiscalRange.start} 〜 ${fiscalRange.end}
- ※会計年度は11月1日〜翌年10月31日

## 注意事項
- 不明な場合は null を設定
- query_type が判定できない場合は "general" を設定
- JSONのみを出力し、説明文は含めない`;
}

// デフォルトのQueryIntent
function getDefaultIntent(): QueryIntent {
  return {
    query_type: 'general',
    time_range: {
      type: 'current_fiscal_year',
      start_date: null,
      end_date: null,
    },
    filters: {
      department: null,
      account_item: null,
      channel: null,
      status: null,
      bank_account_id: null,
    },
    aggregation: {
      group_by: null,
      sort_by: null,
      sort_order: null,
      limit: null,
    },
    comparison: {
      enabled: false,
      compare_to: null,
    },
  };
}

// 入力のサニタイズ
function sanitizeInput(input: string): string {
  // 危険なパターンの検出
  const dangerousPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?(previous\s+)?instructions/i,
    /you\s+are\s+now/i,
    /act\s+as\s+(a\s+)?/i,
    /system\s*:\s*/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid input detected');
    }
  }

  return input.trim().substring(0, 500);
}

/**
 * ユーザーメッセージから意図を解析
 */
export async function classifyIntent(
  message: string,
  context?: { fiscalYear?: number; department?: Department }
): Promise<{ intent: QueryIntent; tokensUsed: number }> {
  try {
    const sanitizedMessage = sanitizeInput(message);

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: getIntentClassificationPrompt() + '\n\n重要: 必ずJSON形式のみで回答してください。説明文は不要です。',
        },
        {
          role: 'user',
          content: sanitizedMessage,
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2000,  // GPT-5-miniは推論トークンを使用するため増加
    });

    const content = response.choices[0].message.content;
    const tokensUsed = response.usage?.total_tokens || 0;
    console.log('[IntentClassifier] OpenAI response:', content);

    if (!content) {
      console.log('[IntentClassifier] No content, using default');
      return { intent: getDefaultIntent(), tokensUsed };
    }

    // JSONをパース
    const parsed = JSON.parse(content);
    console.log('[IntentClassifier] Parsed intent:', parsed.query_type);

    // Zodでバリデーション
    const validation = QueryIntentSchema.safeParse(parsed);

    if (!validation.success) {
      console.warn('Intent validation failed:', validation.error);
      return { intent: getDefaultIntent(), tokensUsed };
    }

    // コンテキストからのオーバーライド
    const intent = validation.data as QueryIntent;

    if (context?.department && !intent.filters.department) {
      intent.filters.department = context.department;
    }

    return { intent, tokensUsed };

  } catch (error) {
    console.error('[IntentClassifier] Error:', error);
    return { intent: getDefaultIntent(), tokensUsed: 0 };
  }
}

// アクション分類用プロンプト
function getActionClassificationPrompt(): string {
  const currentDate = new Date().toISOString().split('T')[0];

  return `あなたは経費・売上管理システムのアシスタントです。
ユーザーの入力を分析し、以下のいずれかのアクションを判定してください。

## アクションタイプ
1. register_expense: 経費を登録したい場合
2. register_sale: 売上を登録したい場合
3. query: データを照会・質問したい場合

## 判定ルール
- 「登録」「追加」「記録」「入れて」「計上」などの言葉 → register系
- 「経費」「出費」「支出」「〇〇代」「〇〇費」+ 登録意図 → register_expense
- 「売上」「収入」「入金」+ 登録意図 → register_sale
- 「いくら」「教えて」「見せて」「一覧」「合計」などの質問 → query

## 出力形式（必ずこのJSON形式のみで出力）
{
  "action_type": "register_expense | register_sale | query",
  "expense_data": {
    "transaction_date": "${currentDate}",
    "amount": 金額（数値）,
    "account_item": "勘定科目名",
    "department": "COMMON",
    "description": "説明（任意）"
  },
  "sale_data": {
    "transaction_date": "${currentDate}",
    "amount": 金額（数値）,
    "client_name": "取引先名",
    "department": "COMMON",
    "channel": "DIRECT",
    "status": "PAID",
    "description": "説明（任意）"
  },
  "confidence": 0.0〜1.0の確信度
}

## 勘定科目の推測ルール
- 「電車」「タクシー」「交通」→ 旅費交通費
- 「ランチ」「飲み会」「会食」→ 接待交際費
- 「文房具」「備品」→ 消耗品費
- 「電話」「ネット」「通信」→ 通信費
- 「外注」「委託」→ 外注費
- 「広告」「宣伝」→ 広告宣伝費
- 「家賃」「オフィス」→ 地代家賃
- 不明な場合 → 雑費

## 部門の推測ルール
- 「写真」「撮影」「フォト」→ PHOTO
- 「動画」「映像」「ビデオ」→ VIDEO
- 「Web」「ウェブ」「サイト」→ WEB
- 特に指定なし → COMMON

## 注意事項
- action_type が "query" の場合、expense_data と sale_data は null にする
- 金額が明示されていない場合は confidence を低く（0.3以下）設定
- JSONのみを出力し、説明文は含めない`;
}

// デフォルトのActionIntent
function getDefaultActionIntent(): ActionIntent {
  return {
    action_type: 'query',
    confidence: 1.0,
  };
}

/**
 * ユーザーメッセージからアクション意図を解析
 */
export async function classifyAction(
  message: string
): Promise<{ actionIntent: ActionIntent; tokensUsed: number }> {
  try {
    const sanitizedMessage = sanitizeInput(message);

    console.log('[ActionClassifier] Calling OpenAI API...');
    console.log('[ActionClassifier] Sanitized message:', sanitizedMessage);

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: getActionClassificationPrompt() + '\n\n重要: 必ずJSON形式のみで回答してください。説明文は不要です。',
        },
        {
          role: 'user',
          content: sanitizedMessage,
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2000,  // GPT-5-miniは推論トークンを使用するため増加
    });

    console.log('[ActionClassifier] Full response:', JSON.stringify(response, null, 2));
    const content = response.choices[0].message.content;
    const tokensUsed = response.usage?.total_tokens || 0;
    console.log('[ActionClassifier] OpenAI response content:', content);
    console.log('[ActionClassifier] Finish reason:', response.choices[0].finish_reason);

    if (!content) {
      console.log('[ActionClassifier] No content, using default');
      return { actionIntent: getDefaultActionIntent(), tokensUsed };
    }

    // JSONをパース
    const parsed = JSON.parse(content);
    console.log('[ActionClassifier] Parsed action:', parsed.action_type);

    // 不要なデータをクリーンアップ
    const cleaned = {
      action_type: parsed.action_type,
      confidence: parsed.confidence,
      expense_data: undefined as typeof parsed.expense_data | undefined,
      sale_data: undefined as typeof parsed.sale_data | undefined,
    };

    // アクションタイプに応じて必要なデータのみを保持
    if (parsed.action_type === 'register_expense' && parsed.expense_data) {
      cleaned.expense_data = parsed.expense_data;
    } else if (parsed.action_type === 'register_sale' && parsed.sale_data) {
      cleaned.sale_data = parsed.sale_data;
    }

    console.log('[ActionClassifier] Cleaned data:', JSON.stringify(cleaned));

    // Zodでバリデーション
    const validation = ActionIntentSchema.safeParse(cleaned);

    if (!validation.success) {
      console.warn('[ActionClassifier] Validation failed:', validation.error);
      return { actionIntent: getDefaultActionIntent(), tokensUsed };
    }

    return { actionIntent: validation.data as ActionIntent, tokensUsed };

  } catch (error) {
    console.error('[ActionClassifier] Error:', error);
    return { actionIntent: getDefaultActionIntent(), tokensUsed: 0 };
  }
}
