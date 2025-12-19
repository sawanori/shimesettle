# Gemini作業指示書

**プロジェクト**: ShimeSettle AIアカウンタントチャット
**作成日**: 2024-12-19
**担当**: 他AI (B) - 26チケット

---

## 1. プロジェクト概要

### 1.1 ShimeSettleとは
ひとり社長・フリーランス向けの経費・売上・銀行口座管理アプリです。

**主要機能**:
- 経費登録（レシートOCR対応）
- 売上登録（請求書OCR対応）
- 銀行取引CSV取り込み
- 会計年度別集計（11月〜翌年10月）

**技術スタック**:
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Auth, Database, Storage)
- OpenAI GPT-5-mini

### 1.2 今回の実装内容
ユーザーが自然言語で財務データを問い合わせできる「AIチャット機能」を追加します。

```
例:
ユーザー: 「先月の経費はいくら？」
AI: 「2024年11月の経費合計は¥285,000です。
     内訳: 消耗品費 ¥120,000、交通費 ¥85,000...」
```

---

## 2. あなたの担当範囲

### 2.1 担当チケット一覧（26件）

| フェーズ | チケット | 内容 |
|---------|---------|------|
| **型定義** | CHAT-016〜019 | TypeScript型、Zodスキーマ |
| **API補助** | CHAT-011, 012, 015 | バリデーション、エラー処理 |
| **意図解析補助** | CHAT-020, 022〜024 | プロンプト、ユーティリティ |
| **クエリ補助** | CHAT-026, 036 | 日付計算、テスト |
| **回答生成補助** | CHAT-037, 039 | プロンプト、フォーマット |
| **フロントエンド** | CHAT-041〜050 | Reactコンポーネント、フック |
| **テスト** | CHAT-052, 053 | E2E、パフォーマンス |

### 2.2 担当しない範囲（Claude Code担当）
- Supabaseテーブル作成・RLS設定
- API Routeの認証・レート制限実装
- データベースクエリ実装
- OpenAI API呼び出し実装

---

## 3. 作業詳細

### 3.1 Week 1: 型定義・バリデーション・プロンプト

#### CHAT-016: QueryIntent 型定義
**ファイル**: `lib/chat/types.ts`

```typescript
// クエリタイプの定義
export type QueryType =
  | 'expense_summary'      // 経費集計
  | 'expense_detail'       // 経費明細
  | 'expense_by_category'  // 勘定科目別経費
  | 'expense_by_department'// 部門別経費
  | 'sales_summary'        // 売上集計
  | 'sales_detail'         // 売上明細
  | 'sales_by_channel'     // チャネル別売上
  | 'sales_by_department'  // 部門別売上
  | 'sales_unpaid'         // 未入金売上
  | 'bank_balance'         // 口座残高
  | 'bank_transactions'    // 銀行取引明細
  | 'cashflow_summary'     // キャッシュフロー
  | 'profit_loss'          // 損益サマリー
  | 'comparison'           // 期間比較
  | 'general'              // 一般的な質問
  | 'unknown';             // 解析不能

// 時間範囲の型
export interface TimeRange {
  type: 'current_month' | 'last_month' | 'current_fiscal_year' | 'custom' | 'all';
  start_date: string | null;  // YYYY-MM-DD
  end_date: string | null;    // YYYY-MM-DD
}

// フィルター条件の型
export interface QueryFilters {
  department: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON' | null;
  account_item: string | null;
  channel: 'DIRECT' | 'REFERRAL' | 'SNS' | 'WEBSITE' | 'PLATFORM_KURASHI' | 'PLATFORM_TOTTA' | 'REPEAT' | 'OTHER' | null;
  status: 'PAID' | 'UNPAID' | null;
  bank_account_id: string | null;
}

// 集計設定の型
export interface QueryAggregation {
  group_by: 'department' | 'account_item' | 'channel' | 'month' | null;
  sort_by: 'amount' | 'date' | null;
  sort_order: 'asc' | 'desc' | null;
  limit: number | null;
}

// 比較設定の型
export interface QueryComparison {
  enabled: boolean;
  compare_to: 'previous_month' | 'previous_year' | null;
}

// 意図解析結果の型
export interface QueryIntent {
  query_type: QueryType;
  time_range: TimeRange;
  filters: QueryFilters;
  aggregation: QueryAggregation;
  comparison: QueryComparison;
}
```

#### CHAT-017: ChatRequest / ChatResponse 型定義
**ファイル**: `lib/chat/types.ts`（続き）

```typescript
// チャットリクエストの型
export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    fiscalYear?: number;
    department?: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON';
  };
}

// チャットメッセージの型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: QueryResult;
  timestamp: string;  // ISO 8601
}

// チャットレスポンスの型
export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  suggestions?: string[];
}
```

#### CHAT-018: QueryResult 型定義
**ファイル**: `lib/chat/types.ts`（続き）

```typescript
// クエリ結果の型
export interface QueryResult {
  type: 'summary' | 'table' | 'chart';
  title?: string;
  columns?: { key: string; label: string }[];
  data: Record<string, any>[];
  total?: number;
  metadata?: {
    query_type: QueryType;
    date_range?: { start: string; end: string };
    filters?: Record<string, any>;
  };
}
```

#### CHAT-019: ChatError 型・定数定義
**ファイル**: `lib/chat/errors.ts`

```typescript
// エラーコードの定義
export type ChatErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_QUERY'
  | 'NO_DATA'
  | 'INTERNAL_ERROR';

// エラーレスポンスの型
export interface ChatErrorResponse {
  error: string;
  code: ChatErrorCode;
  details?: string;
}

// エラー定数
export const ChatErrors = {
  UNAUTHORIZED: {
    error: '認証が必要です',
    code: 'UNAUTHORIZED' as const,
    statusCode: 401,
  },
  RATE_LIMITED: {
    error: 'リクエスト制限に達しました。しばらく待ってから再度お試しください。',
    code: 'RATE_LIMITED' as const,
    statusCode: 429,
  },
  INVALID_QUERY: {
    error: '質問を理解できませんでした。別の言い方でお試しください。',
    code: 'INVALID_QUERY' as const,
    statusCode: 400,
  },
  NO_DATA: {
    error: '該当するデータがありません',
    code: 'NO_DATA' as const,
    statusCode: 200,
  },
  INTERNAL_ERROR: {
    error: 'エラーが発生しました。しばらく待ってから再度お試しください。',
    code: 'INTERNAL_ERROR' as const,
    statusCode: 500,
  },
} as const;
```

#### CHAT-011: リクエストバリデーション（Zodスキーマ）
**ファイル**: `lib/chat/schemas.ts`

```typescript
import { z } from 'zod';

// チャットリクエストのバリデーションスキーマ
export const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'メッセージを入力してください')
    .max(500, 'メッセージは500文字以内で入力してください'),
  conversationId: z.string().uuid().optional(),
  context: z
    .object({
      fiscalYear: z.number().int().min(2020).max(2100).optional(),
      department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']).optional(),
    })
    .optional(),
});

// バリデーション関数
export function validateChatRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}
```

#### CHAT-012: エラーハンドリング共通化
**ファイル**: `lib/chat/errors.ts`（追記）

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// エラーレスポンスを生成するヘルパー関数
export function createErrorResponse(
  error: keyof typeof ChatErrors,
  details?: string
): NextResponse {
  const errorInfo = ChatErrors[error];
  return NextResponse.json(
    {
      error: errorInfo.error,
      code: errorInfo.code,
      details,
    },
    { status: errorInfo.statusCode }
  );
}

// Zodエラーをフォーマットする関数
export function formatZodError(error: ZodError): string {
  return error.errors.map((e) => e.message).join(', ');
}

// 例外からエラーレスポンスを生成
export function handleApiError(error: unknown): NextResponse {
  console.error('Chat API Error:', error);

  if (error instanceof ZodError) {
    return createErrorResponse('INVALID_QUERY', formatZodError(error));
  }

  if (error instanceof Error) {
    // 特定のエラーメッセージをチェック
    if (error.message.includes('rate limit')) {
      return createErrorResponse('RATE_LIMITED');
    }
    if (error.message.includes('unauthorized')) {
      return createErrorResponse('UNAUTHORIZED');
    }
  }

  return createErrorResponse('INTERNAL_ERROR');
}
```

#### CHAT-020: 意図解析プロンプト作成
**ファイル**: `lib/chat/prompts.ts`

```typescript
import { getCurrentFiscalYear, getFiscalYearRange } from '@/lib/fiscalYear';

// 現在の日付を取得
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// 意図解析用プロンプトを生成
export function getIntentClassificationPrompt(): string {
  const currentDate = getCurrentDate();
  const fiscalYear = getCurrentFiscalYear();
  const fiscalRange = getFiscalYearRange(fiscalYear);

  return `あなたは財務データクエリの意図解析AIです。
ユーザーの質問から、以下の情報をJSON形式で抽出してください。

## 出力形式（必ずこの形式で出力）
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
    "bank_account_id": "uuid または null"
  },
  "aggregation": {
    "group_by": "department | account_item | channel | month または null",
    "sort_by": "amount | date または null",
    "sort_order": "asc | desc または null",
    "limit": "数値 または null"
  },
  "comparison": {
    "enabled": true | false,
    "compare_to": "previous_month | previous_year または null"
  }
}

## クエリタイプの判定ルール
- 「経費」「出費」「支出」→ expense系
- 「売上」「収入」「売り上げ」→ sales系
- 「未入金」「未払い」「入金待ち」→ sales_unpaid
- 「残高」「口座」→ bank_balance
- 「収支」「利益」「損益」→ profit_loss
- 「比較」「前月比」「前年比」→ comparison
- 「内訳」「科目別」「カテゴリ別」→ *_by_category
- 「部門別」→ *_by_department
- 「チャネル別」「経路別」→ sales_by_channel

## 時間表現の解釈ルール
- 「今月」→ type: current_month
- 「先月」「前月」→ type: last_month
- 「今年度」「今期」→ type: current_fiscal_year
- 「去年」「昨年」→ 前年の1月〜12月
- 「〇月」「〇月分」→ 当年の該当月（custom + 具体的日付）
- 時間指定なし → type: current_fiscal_year（デフォルト）

## 部門の判定ルール
- 「写真」「撮影」「カメラ」→ PHOTO
- 「動画」「映像」「ビデオ」→ VIDEO
- 「Web」「ウェブ」「サイト」→ WEB
- 「共通」「全体」「その他」→ COMMON

## 勘定科目の例
- 旅費交通費、消耗品費、通信費、外注費、接待交際費、広告宣伝費、地代家賃

## 現在の情報
- 今日の日付: ${currentDate}
- 現在の会計年度: ${fiscalYear}年度
- 会計年度の期間: ${fiscalRange.start} 〜 ${fiscalRange.end}
- ※会計年度は11月1日〜翌年10月31日

## 注意事項
- 不明な場合は null を設定
- query_type が判定できない場合は "unknown" を設定
- JSONのみを出力し、説明文は不要`;
}

// デフォルトの質問サジェスト
export const defaultSuggestions = [
  '今月の経費はいくら？',
  '未入金の売上を教えて',
  '部門別の売上比較',
  '今年度の収支サマリー',
  '交通費の合計は？',
  'くらしのマーケット経由の売上',
];
```

#### CHAT-022: 時間表現パーサー実装
**ファイル**: `lib/chat/utils.ts`

```typescript
import { getFiscalYearRange, getCurrentFiscalYear } from '@/lib/fiscalYear';
import type { TimeRange } from './types';

/**
 * TimeRange から具体的な日付範囲を計算
 */
export function calculateDateRange(timeRange: TimeRange): { start: string; end: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11

  switch (timeRange.type) {
    case 'current_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0); // 月末
      return {
        start: formatDate(start),
        end: formatDate(end),
      };
    }

    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0); // 前月末
      return {
        start: formatDate(start),
        end: formatDate(end),
      };
    }

    case 'current_fiscal_year': {
      const fiscalYear = getCurrentFiscalYear();
      return getFiscalYearRange(fiscalYear);
    }

    case 'custom': {
      // カスタム範囲: start_date と end_date を使用
      return {
        start: timeRange.start_date || formatDate(new Date(year, 0, 1)),
        end: timeRange.end_date || formatDate(today),
      };
    }

    case 'all':
    default: {
      // 全期間: 非常に広い範囲を設定
      return {
        start: '2020-01-01',
        end: formatDate(today),
      };
    }
  }
}

/**
 * Date を YYYY-MM-DD 形式にフォーマット
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付文字列を日本語表記に変換
 */
export function formatDateJapanese(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 月名を取得（例: "2024年11月"）
 */
export function getMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
```

#### CHAT-023: プロンプトインジェクション対策
**ファイル**: `lib/chat/security.ts`

```typescript
// 危険なパターンの定義
const DANGEROUS_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?(previous\s+)?instructions/i,
  /forget\s+(all\s+)?(previous\s+)?instructions/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(a\s+)?/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  /system\s*:\s*/i,
  /\[system\]/i,
  /\{system\}/i,
  /<system>/i,
  /assistant\s*:\s*/i,
  /\[assistant\]/i,
];

// 最大メッセージ長
const MAX_MESSAGE_LENGTH = 500;

/**
 * ユーザー入力をサニタイズ
 * @throws Error 危険なパターンが検出された場合
 */
export function sanitizeUserInput(input: string): string {
  // 空白をトリム
  const trimmed = input.trim();

  // 長さチェック
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`);
  }

  // 空チェック
  if (trimmed.length === 0) {
    throw new Error('メッセージを入力してください');
  }

  // 危険なパターンをチェック
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.warn('Potential prompt injection detected:', trimmed.substring(0, 50));
      throw new Error('無効な入力が検出されました');
    }
  }

  // 制御文字を除去
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * 入力が安全かどうかをチェック（例外を投げない）
 */
export function isInputSafe(input: string): boolean {
  try {
    sanitizeUserInput(input);
    return true;
  } catch {
    return false;
  }
}
```

#### CHAT-039: 金額フォーマットユーティリティ
**ファイル**: `lib/chat/utils.ts`（追記）

```typescript
/**
 * 金額を日本円形式でフォーマット（3桁区切り）
 * 例: 1234567 → "¥1,234,567"
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * 金額を短縮形式でフォーマット
 * 例: 1234567 → "約123万円"
 */
export function formatCurrencyShort(amount: number): string {
  if (amount >= 100000000) {
    return `約${Math.round(amount / 100000000)}億円`;
  }
  if (amount >= 10000) {
    return `約${Math.round(amount / 10000)}万円`;
  }
  return formatCurrency(amount);
}

/**
 * パーセンテージをフォーマット
 * 例: 0.156 → "+15.6%"
 */
export function formatPercentage(value: number, showSign = true): string {
  const percentage = (value * 100).toFixed(1);
  if (showSign && value > 0) {
    return `+${percentage}%`;
  }
  return `${percentage}%`;
}

/**
 * 数値の増減を表す矢印を取得
 */
export function getTrendIcon(current: number, previous: number): string {
  if (current > previous) return '↑';
  if (current < previous) return '↓';
  return '→';
}
```

#### CHAT-037: 回答生成プロンプト作成
**ファイル**: `lib/chat/prompts.ts`（追記）

```typescript
import type { QueryResult } from './types';

/**
 * 回答生成用プロンプトを生成
 */
export function getResponseGenerationPrompt(
  userMessage: string,
  queryResult: QueryResult
): string {
  return `あなたは親切で知識豊富な会計アシスタントです。
ユーザーの質問と取得したデータに基づいて、自然な日本語で回答してください。

## ルール
1. 金額は3桁区切りで「¥」を付けて表示（例: ¥1,234,567）
2. 日付は「YYYY年MM月DD日」形式で表示
3. 専門用語は避け、わかりやすい表現を使用
4. 簡潔に要点を伝える（1-3文程度）
5. 必要に応じて内訳や詳細を箇条書きで追加
6. データがない場合は「該当するデータがありません」と丁寧に伝える
7. 絵文字は使用しない

## ユーザーの質問
${userMessage}

## 取得データ
${JSON.stringify(queryResult, null, 2)}

## 回答形式の例

### 集計データの場合
「2024年11月の経費合計は¥285,000です。
主な内訳:
・消耗品費: ¥120,000
・交通費: ¥85,000
・通信費: ¥80,000」

### 一覧データの場合
「未入金の売上が3件あります。
・ABC株式会社: ¥150,000（11/15）
・DEF合同会社: ¥80,000（11/20）
・GHI商事: ¥50,000（11/25）
合計: ¥280,000」

### データなしの場合
「該当する期間のデータがありませんでした。
条件を変えてお試しください。」

## 注意
- JSON形式ではなく、自然な日本語の文章で回答
- 回答のみを出力（説明文や前置きは不要）`;
}
```

---

### 3.2 Week 2: ユーティリティ

#### CHAT-026: 日付範囲計算ユーティリティ
※ CHAT-022 で実装済み（`lib/chat/utils.ts` の `calculateDateRange`）

追加で以下も実装:

```typescript
// lib/chat/utils.ts に追記

/**
 * 前月の日付範囲を取得
 */
export function getPreviousMonthRange(baseDate: Date = new Date()): { start: string; end: string } {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

/**
 * 前年同月の日付範囲を取得
 */
export function getPreviousYearSameMonthRange(baseDate: Date = new Date()): { start: string; end: string } {
  const year = baseDate.getFullYear() - 1;
  const month = baseDate.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

/**
 * 期間のラベルを生成
 */
export function getDateRangeLabel(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  // 同じ月の場合
  if (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()
  ) {
    return `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
  }

  // 会計年度の場合（11月〜10月）
  if (
    startDate.getMonth() === 10 && // 11月
    endDate.getMonth() === 9 // 10月
  ) {
    return `${endDate.getFullYear()}年度`;
  }

  // その他
  return `${formatDateJapanese(start)} 〜 ${formatDateJapanese(end)}`;
}
```

---

### 3.3 Week 3: フロントエンドコンポーネント

#### CHAT-041: ChatWidget コンポーネント（開閉制御）
**ファイル**: `components/chat/ChatWidget.tsx`

```typescript
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
        <div className="fixed bottom-20 right-4 z-50 w-96 h-[500px] shadow-2xl rounded-lg overflow-hidden border border-gray-200 bg-white md:w-96 max-md:inset-4 max-md:bottom-4 max-md:right-4 max-md:w-auto max-md:h-auto">
          <ChatContainer onClose={() => setIsOpen(false)} />
        </div>
      )}

      {/* トグルボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
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
```

#### CHAT-042: ChatContainer コンポーネント
**ファイル**: `components/chat/ChatContainer.tsx`

```typescript
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
    <div className="flex flex-col h-full">
      <ChatHeader onClose={onClose} onClear={clearHistory} />

      <div className="flex-1 overflow-hidden">
        {showSuggestions ? (
          <ChatSuggestions onSelect={sendMessage} />
        ) : (
          <ChatMessages messages={messages} isLoading={isLoading} />
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
```

#### CHAT-043: ChatHeader コンポーネント
**ファイル**: `components/chat/ChatHeader.tsx`

```typescript
'use client';

import { X, Trash2 } from 'lucide-react';

interface ChatHeaderProps {
  onClose: () => void;
  onClear: () => void;
}

export function ChatHeader({ onClose, onClear }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-sm font-bold">AI</span>
        </div>
        <span className="font-medium">AIアカウンタント</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="p-1.5 hover:bg-white/20 rounded transition-colors"
          aria-label="履歴をクリア"
          title="履歴をクリア"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/20 rounded transition-colors"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

#### CHAT-044: ChatMessages コンポーネント
**ファイル**: `components/chat/ChatMessages.tsx`

```typescript
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
```

#### CHAT-045: ChatMessage コンポーネント（AI/User）
**ファイル**: `components/chat/ChatMessage.tsx`

```typescript
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
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-gray-200' : 'bg-blue-100'
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
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
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
```

#### CHAT-046: ChatInput コンポーネント（IME対応）
**ファイル**: `components/chat/ChatInput.tsx`

```typescript
'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const isComposingRef = useRef(false);

  // IME変換開始
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  // IME変換終了
  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  // メッセージ送信
  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
    }
  }, [value, disabled, onSend]);

  // キーボードイベント
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // IME変換中は無視
      if (isComposingRef.current) return;

      // Enter で送信（Shift+Enter は改行）
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-gray-200 p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="質問を入力..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          aria-label="送信"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Enter で送信 / Shift+Enter で改行
      </p>
    </div>
  );
}
```

#### CHAT-047: ChatSuggestions コンポーネント
**ファイル**: `components/chat/ChatSuggestions.tsx`

```typescript
'use client';

import { defaultSuggestions } from '@/lib/chat/prompts';
import { Sparkles } from 'lucide-react';

interface ChatSuggestionsProps {
  onSelect: (message: string) => void;
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-blue-600" />
      </div>

      <h3 className="text-lg font-medium text-gray-800 mb-2">
        AIアカウンタント
      </h3>

      <p className="text-sm text-gray-500 text-center mb-6">
        財務データについて何でも聞いてください
      </p>

      <div className="w-full space-y-2">
        <p className="text-xs text-gray-400 mb-2">よくある質問:</p>
        {defaultSuggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="w-full text-left px-4 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### CHAT-048: DataTable コンポーネント（表形式表示）
**ファイル**: `components/chat/DataTable.tsx`

```typescript
'use client';

import type { QueryResult } from '@/lib/chat/types';
import { formatCurrency } from '@/lib/chat/utils';
import { Download } from 'lucide-react';

interface DataTableProps {
  data: QueryResult;
}

export function DataTable({ data }: DataTableProps) {
  if (!data.data || data.data.length === 0) {
    return null;
  }

  const columns = data.columns || Object.keys(data.data[0]).map(key => ({
    key,
    label: key,
  }));

  // CSVエクスポート
  const handleExport = () => {
    const headers = columns.map(c => c.label).join(',');
    const rows = data.data.map(row =>
      columns.map(c => {
        const value = row[c.key];
        // 数値の場合はそのまま、それ以外はクォートで囲む
        return typeof value === 'number' ? value : `"${value || ''}"`;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title || 'data'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      {data.title && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-600">{data.title}</span>
          <button
            onClick={handleExport}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="CSVダウンロード"
          >
            <Download className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-100">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-3 py-2 whitespace-nowrap"
                  >
                    {formatCellValue(row[column.key], column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.total !== undefined && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-right">
          <span className="text-xs text-gray-500">合計: </span>
          <span className="text-sm font-medium">{formatCurrency(data.total)}</span>
        </div>
      )}
    </div>
  );
}

// セル値のフォーマット
function formatCellValue(value: any, key: string): string {
  if (value === null || value === undefined) {
    return '-';
  }

  // 金額系のキーの場合
  if (key.includes('amount') || key.includes('total') || key.includes('balance')) {
    return formatCurrency(Number(value));
  }

  return String(value);
}
```

---

### 3.4 Week 4: フック・テスト

#### CHAT-049: useChatMessages カスタムフック
**ファイル**: `hooks/useChatMessages.ts`

```typescript
'use client';

import { useState, useCallback } from 'react';
import type { ChatMessage, ChatResponse } from '@/lib/chat/types';

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

  const sendMessage = useCallback(async (message: string) => {
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
        throw new Error(errorData.error || 'エラーが発生しました');
      }

      const data: ChatResponse = await response.json();

      // AIの回答を追加
      setMessages((prev) => [...prev, data.message]);
      setConversationId(data.conversationId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);

      // エラー時はユーザーメッセージを削除
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
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
```

#### CHAT-050: チャット状態の永続化（localStorage）
**ファイル**: `hooks/useChatMessages.ts`（修正版）

```typescript
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages: trimmedMessages,
      conversationId: state.conversationId,
    }));
  } catch {
    // ストレージエラーは無視
  }
}

export function useChatMessages() {
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

  const sendMessage = useCallback(async (message: string) => {
    // ... 前述の実装と同じ
  }, [conversationId]);

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
```

#### CHAT-015: GET /api/chat/suggestions エンドポイント
**ファイル**: `app/api/chat/suggestions/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { defaultSuggestions } from '@/lib/chat/prompts';

export async function GET() {
  // 将来的にはユーザーの使用履歴に基づいて
  // パーソナライズされたサジェストを返す
  return NextResponse.json({
    suggestions: defaultSuggestions,
  });
}
```

---

## 4. コーディング規約

### 4.1 ファイル命名規則
- コンポーネント: `PascalCase.tsx` (例: `ChatWidget.tsx`)
- ユーティリティ: `camelCase.ts` (例: `utils.ts`)
- 型定義: `types.ts`
- 定数: `UPPER_SNAKE_CASE`

### 4.2 コンポーネント規約
```typescript
// 'use client' は必要な場合のみ（イベントハンドラ、useState等使用時）
'use client';

// インポート順序: react → ライブラリ → 内部モジュール → 型
import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/chat/utils';
import type { ChatMessage } from '@/lib/chat/types';

// Props は interface で定義
interface ComponentProps {
  prop1: string;
  prop2?: number;
}

// 関数コンポーネント（export function）
export function Component({ prop1, prop2 = 0 }: ComponentProps) {
  // ...
}
```

### 4.3 スタイリング
- Tailwind CSS を使用
- カスタムCSSは避ける
- レスポンシブ: `max-md:` プレフィックス使用

### 4.4 型安全性
- `any` は使用禁止
- `unknown` + 型ガードを使用
- 関数の戻り値型を明示

---

## 5. 受け渡し手順

### 5.1 あなた → Claude Code
1. 作成したファイルをプロジェクトに配置
2. コミットメッセージ: `[CHAT-XXX] 実装内容の説明`

### 5.2 Claude Code → あなた
1. DBスキーマ情報: `types/supabase.ts` の更新を確認
2. APIエンドポイント: `/api/chat` のレスポンス形式を確認

---

## 6. テスト方法

### 6.1 ローカル確認
```bash
npm run dev
# http://localhost:3000 でアプリを開く
# 右下のチャットアイコンをクリック
```

### 6.2 型チェック
```bash
npm run lint
npx tsc --noEmit
```

---

## 7. 質問・確認事項

不明点がある場合は、以下の情報と共に確認してください:
- チケットID
- 該当ファイル
- 具体的な質問内容

---

**作成者**: Claude Code
**最終更新**: 2024-12-19
