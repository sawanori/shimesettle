# AIチャット財務クエリ機能 要件定義書

**プロジェクト名**: ShimeSettle AIアカウンタントチャット
**バージョン**: 1.0
**作成日**: 2024-12-19
**ステータス**: ドラフト

---

## 1. 概要

### 1.1 目的
ユーザーが自然言語で財務データに関する質問を行い、AIが適切なデータを取得・分析して回答するチャット機能を実装する。

### 1.2 スコープ
- 経費・売上・銀行取引データへの自然言語クエリ
- 集計・分析結果の自然言語での回答
- 会話履歴の保持とコンテキスト理解

### 1.3 対象ユーザー
- ShimeSettleを利用するひとり社長・フリーランス
- 会計知識が限定的なユーザーでも利用可能

---

## 2. フロントエンド要件

### 2.1 UI/UXデザイン

#### 2.1.1 チャットインターフェース
| 要素 | 仕様 |
|------|------|
| 配置 | サイドバーまたはフローティングウィジェット（右下固定） |
| 開閉 | トグルボタンで展開/折りたたみ |
| サイズ | 幅: 400px / 高さ: 500px（展開時） |
| レスポンシブ | モバイル: フルスクリーンモーダル |

#### 2.1.2 メッセージ表示
```
┌─────────────────────────────────────┐
│  AIアカウンタント            [−][×] │
├─────────────────────────────────────┤
│                                     │
│  [AI] こんにちは！財務に関する      │
│       質問をどうぞ。                │
│                                     │
│                    [User] 先月の    │
│                           経費は？  │
│                                     │
│  [AI] 2024年11月の経費合計は       │
│       ¥285,000 です。               │
│       ┌─────────────────┐          │
│       │ 消耗品費  ¥120,000│          │
│       │ 交通費    ¥85,000 │          │
│       │ 通信費    ¥80,000 │          │
│       └─────────────────┘          │
│                                     │
├─────────────────────────────────────┤
│  [質問を入力...]          [送信]    │
└─────────────────────────────────────┘
```

#### 2.1.3 コンポーネント構成
```
components/
  chat/
    ChatWidget.tsx          # メインウィジェット（開閉制御）
    ChatContainer.tsx       # チャットコンテナ
    ChatHeader.tsx          # ヘッダー（タイトル・閉じるボタン）
    ChatMessages.tsx        # メッセージ一覧表示
    ChatMessage.tsx         # 個別メッセージ（AI/User）
    ChatInput.tsx           # 入力フォーム（IME対応）
    ChatSuggestions.tsx     # 質問サジェスト表示
    DataTable.tsx           # 表形式データ表示
    DataChart.tsx           # グラフ表示（オプション）
```

#### 2.1.4 状態管理
```typescript
interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  suggestions: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: QueryResult;      // 構造化データ（表・グラフ用）
  timestamp: Date;
}

interface QueryResult {
  type: 'summary' | 'table' | 'chart';
  title?: string;
  data: Record<string, any>[];
  total?: number;
}
```

#### 2.1.5 インタラクション仕様

| アクション | 動作 |
|-----------|------|
| メッセージ送信 | Enter または送信ボタン |
| 改行 | Shift + Enter |
| 履歴スクロール | 自動スクロール（最新メッセージへ） |
| サジェストクリック | 質問をインプットに挿入して送信 |
| データコピー | テーブルデータをクリップボードにコピー |
| CSVエクスポート | テーブルデータをCSVダウンロード |

#### 2.1.6 質問サジェスト（初期表示）
```typescript
const defaultSuggestions = [
  "今月の経費はいくら？",
  "未入金の売上を教えて",
  "部門別の売上比較",
  "今年度の収支サマリー",
];
```

### 2.2 技術要件

#### 2.2.1 使用技術
- React 19 + TypeScript
- Tailwind CSS 4
- Framer Motion（アニメーション）
- React Query（API状態管理）

#### 2.2.2 パフォーマンス要件
| 項目 | 目標値 |
|------|--------|
| 初期表示 | < 100ms |
| メッセージ送信〜ローディング表示 | < 50ms |
| ウィジェット開閉アニメーション | 200ms |

#### 2.2.3 アクセシビリティ
- キーボードナビゲーション対応
- スクリーンリーダー対応（ARIA属性）
- フォーカス管理

---

## 3. バックエンド要件

### 3.1 API設計

#### 3.1.1 エンドポイント一覧
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/chat` | チャットメッセージ送信 |
| GET | `/api/chat/history` | 会話履歴取得 |
| DELETE | `/api/chat/history` | 会話履歴削除 |
| GET | `/api/chat/suggestions` | サジェスト取得 |

#### 3.1.2 POST /api/chat

**リクエスト**
```typescript
interface ChatRequest {
  message: string;
  conversationId?: string;  // 継続会話の場合
  context?: {
    fiscalYear?: number;
    department?: Department;
  };
}
```

**レスポンス**
```typescript
interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'assistant';
    content: string;
    data?: QueryResult;
    timestamp: string;
  };
  suggestions?: string[];  // 次の質問候補
}

interface QueryResult {
  type: 'summary' | 'table' | 'chart';
  title?: string;
  columns?: { key: string; label: string }[];
  data: Record<string, any>[];
  total?: number;
  metadata?: {
    query_type: string;
    date_range?: { start: string; end: string };
    filters?: Record<string, any>;
  };
}
```

**エラーレスポンス**
```typescript
interface ChatError {
  error: string;
  code: 'UNAUTHORIZED' | 'RATE_LIMITED' | 'INVALID_QUERY' | 'INTERNAL_ERROR';
  details?: string;
}
```

### 3.2 処理フロー

```
┌─────────────────────────────────────────────────────────────────┐
│                        POST /api/chat                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. 認証チェック                                                  │
│    - Supabase Auth でユーザー認証                                │
│    - 未認証: 401 Unauthorized                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. レート制限チェック                                            │
│    - ユーザーごと: 30回/分                                       │
│    - 超過: 429 Too Many Requests                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. 意図解析（Intent Classification）                            │
│    - GPT-5-mini で自然言語を解析                                 │
│    - クエリタイプ・パラメータを抽出                              │
│    - 出力: QueryIntent オブジェクト                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. データ取得（Query Execution）                                │
│    - QueryIntent に基づき Supabase クエリ生成                    │
│    - RLS によりユーザーデータのみ取得                            │
│    - 集計・フィルタリング実行                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. 回答生成（Response Generation）                              │
│    - 取得データを GPT-5-mini に渡す                              │
│    - 自然言語での回答文を生成                                    │
│    - 構造化データ（表・グラフ）を付与                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. 会話履歴保存                                                  │
│    - chat_conversations テーブルに保存                          │
│    - コンテキスト維持用                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. レスポンス返却                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 意図解析（Intent Classification）

#### 3.3.1 対応クエリタイプ
```typescript
type QueryType =
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
```

#### 3.3.2 意図解析プロンプト
```typescript
const intentPrompt = `
あなたは財務データクエリの意図解析AIです。
ユーザーの質問から、以下の情報をJSON形式で抽出してください。

## 出力形式
{
  "query_type": "expense_summary | expense_detail | ...",
  "time_range": {
    "type": "current_month | last_month | current_fiscal_year | custom | all",
    "start_date": "YYYY-MM-DD" | null,
    "end_date": "YYYY-MM-DD" | null
  },
  "filters": {
    "department": "PHOTO | VIDEO | WEB | COMMON" | null,
    "account_item": "勘定科目名" | null,
    "channel": "DIRECT | PLATFORM_KURASHI | ..." | null,
    "status": "PAID | UNPAID" | null,
    "bank_account_id": "uuid" | null
  },
  "aggregation": {
    "group_by": "department | account_item | channel | month" | null,
    "sort_by": "amount | date" | null,
    "sort_order": "asc | desc" | null,
    "limit": number | null
  },
  "comparison": {
    "enabled": boolean,
    "compare_to": "previous_month | previous_year" | null
  }
}

## 時間表現の解釈ルール
- "今月" → current_month
- "先月" → last_month
- "今年度" → current_fiscal_year (11月〜翌年10月)
- "去年" → 前年の1月〜12月
- "〇月" → 当年の該当月
- 指定なし → current_fiscal_year

## 現在の日付
${new Date().toISOString().split('T')[0]}

## 現在の会計年度
${getCurrentFiscalYear()}年度（${getCurrentFiscalYear()-1}年11月〜${getCurrentFiscalYear()}年10月）
`;
```

#### 3.3.3 QueryIntent インターフェース
```typescript
interface QueryIntent {
  query_type: QueryType;
  time_range: {
    type: 'current_month' | 'last_month' | 'current_fiscal_year' | 'custom' | 'all';
    start_date: string | null;
    end_date: string | null;
  };
  filters: {
    department: Department | null;
    account_item: string | null;
    channel: SalesChannel | null;
    status: 'PAID' | 'UNPAID' | null;
    bank_account_id: string | null;
  };
  aggregation: {
    group_by: 'department' | 'account_item' | 'channel' | 'month' | null;
    sort_by: 'amount' | 'date' | null;
    sort_order: 'asc' | 'desc' | null;
    limit: number | null;
  };
  comparison: {
    enabled: boolean;
    compare_to: 'previous_month' | 'previous_year' | null;
  };
}
```

### 3.4 データ取得層

#### 3.4.1 クエリビルダー
```typescript
// lib/chat/queryBuilder.ts

export class FinancialQueryBuilder {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  async execute(intent: QueryIntent): Promise<QueryResult> {
    switch (intent.query_type) {
      case 'expense_summary':
        return this.getExpenseSummary(intent);
      case 'expense_by_category':
        return this.getExpenseByCategory(intent);
      case 'sales_summary':
        return this.getSalesSummary(intent);
      case 'sales_unpaid':
        return this.getUnpaidSales(intent);
      case 'profit_loss':
        return this.getProfitLoss(intent);
      // ... 他のクエリタイプ
      default:
        throw new Error(`Unknown query type: ${intent.query_type}`);
    }
  }

  private async getExpenseSummary(intent: QueryIntent): Promise<QueryResult> {
    let query = this.supabase
      .from('expenses')
      .select('amount, department, account_item, transaction_date');

    // 時間範囲フィルタ
    const { start, end } = this.getDateRange(intent.time_range);
    if (start) query = query.gte('transaction_date', start);
    if (end) query = query.lte('transaction_date', end);

    // 部門フィルタ
    if (intent.filters.department) {
      query = query.eq('department', intent.filters.department);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 集計処理
    const total = data.reduce((sum, row) => sum + row.amount, 0);
    const byCategory = this.groupBy(data, 'account_item', 'amount');

    return {
      type: 'summary',
      title: '経費サマリー',
      data: byCategory,
      total,
      metadata: {
        query_type: 'expense_summary',
        date_range: { start, end },
        filters: intent.filters,
      },
    };
  }

  // ... 他のメソッド
}
```

#### 3.4.2 対応クエリパターン

| クエリタイプ | テーブル | 主な集計 |
|-------------|---------|---------|
| expense_summary | expenses | SUM(amount) |
| expense_by_category | expenses | GROUP BY account_item |
| expense_by_department | expenses | GROUP BY department |
| sales_summary | sales | SUM(amount), SUM(net_amount) |
| sales_by_channel | sales | GROUP BY channel |
| sales_unpaid | sales | WHERE status = 'UNPAID' |
| bank_balance | bank_accounts, bank_transactions | 最新残高 |
| profit_loss | expenses, sales | 売上 - 経費 |

### 3.5 回答生成

#### 3.5.1 回答生成プロンプト
```typescript
const responsePrompt = `
あなたは親切な会計アシスタントです。
ユーザーの質問と取得したデータに基づいて、自然な日本語で回答してください。

## ルール
1. 金額は3桁区切りで表示（例: ¥1,234,567）
2. 日付は「YYYY年MM月DD日」形式
3. 専門用語は避け、わかりやすい表現を使用
4. データがない場合は「該当するデータがありません」と回答
5. 必要に応じて補足説明や提案を追加

## ユーザーの質問
${userMessage}

## 取得データ
${JSON.stringify(queryResult, null, 2)}

## 回答形式
- 簡潔に要点を伝える（1-3文）
- 必要なら内訳や詳細を箇条書きで追加
- 金額の大小や傾向についてコメント（任意）
`;
```

### 3.6 セキュリティ要件

#### 3.6.1 認証・認可
- Supabase Auth による認証必須
- RLS により自身のデータのみアクセス可能
- API キーの露出防止（サーバーサイドのみ）

#### 3.6.2 入力検証
```typescript
// lib/chat/validation.ts

import { z } from 'zod';

export const ChatRequestSchema = z.object({
  message: z.string()
    .min(1, 'メッセージを入力してください')
    .max(500, 'メッセージは500文字以内で入力してください'),
  conversationId: z.string().uuid().optional(),
  context: z.object({
    fiscalYear: z.number().int().min(2020).max(2100).optional(),
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']).optional(),
  }).optional(),
});
```

#### 3.6.3 レート制限
| 制限タイプ | 値 | 対象 |
|-----------|-----|------|
| リクエスト数 | 30回/分 | ユーザーごと |
| メッセージ長 | 500文字 | リクエストごと |
| 会話履歴 | 100件 | ユーザーごと |

#### 3.6.4 プロンプトインジェクション対策
```typescript
// ユーザー入力のサニタイズ
function sanitizeUserInput(input: string): string {
  // システムプロンプト上書き試行の検出
  const dangerousPatterns = [
    /ignore previous instructions/i,
    /disregard.*prompt/i,
    /you are now/i,
    /act as/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid input detected');
    }
  }

  return input.trim();
}
```

### 3.7 エラーハンドリング

```typescript
// lib/chat/errors.ts

export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

export const ChatErrors = {
  UNAUTHORIZED: new ChatError('認証が必要です', 'UNAUTHORIZED', 401),
  RATE_LIMITED: new ChatError('リクエスト制限に達しました', 'RATE_LIMITED', 429),
  INVALID_QUERY: new ChatError('質問を理解できませんでした', 'INVALID_QUERY', 400),
  NO_DATA: new ChatError('該当するデータがありません', 'NO_DATA', 200),
  INTERNAL_ERROR: new ChatError('エラーが発生しました', 'INTERNAL_ERROR', 500),
};
```

---

## 4. データベース/インフラ要件

### 4.1 新規テーブル設計

#### 4.1.1 chat_conversations（会話管理）
```sql
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,  -- 会話の要約タイトル（自動生成）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS ポリシー
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
```

#### 4.1.2 chat_messages（メッセージ履歴）
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  data JSONB,  -- 構造化データ（QueryResult）
  intent JSONB,  -- 解析された意図（デバッグ用）
  tokens_used INTEGER,  -- トークン使用量
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS ポリシー
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- インデックス
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

#### 4.1.3 chat_usage（使用量追跡）
```sql
CREATE TABLE chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- RLS ポリシー
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON chat_usage FOR SELECT
  USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_chat_usage_user_date ON chat_usage(user_id, date);
```

### 4.2 既存テーブルへの影響

既存テーブル（expenses, sales, bank_accounts, bank_transactions）への変更は不要。
RLS が有効なため、チャット機能からのクエリも自動的にユーザーデータのみに制限される。

### 4.3 マイグレーション

```sql
-- migrations/003_create_chat_tables.sql

-- 1. chat_conversations テーブル
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conversations_select" ON chat_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_conversations_insert" ON chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_conversations_delete" ON chat_conversations
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
  ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at
  ON chat_conversations(updated_at DESC);

-- 2. chat_messages テーブル
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  data JSONB,
  intent JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
  ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages(created_at);

-- 3. chat_usage テーブル
CREATE TABLE IF NOT EXISTS chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_usage_select" ON chat_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_usage_upsert" ON chat_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_usage_update" ON chat_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date
  ON chat_usage(user_id, date);

-- 4. updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 4.4 インフラ構成

#### 4.4.1 現行構成（変更なし）
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │────▶│  Supabase   │     │   OpenAI    │
│  (Next.js)  │     │  (Postgres) │     │   (GPT-5)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       └───────────────────┴───────────────────┘
                     API Routes
```

#### 4.4.2 環境変数（追加なし）
既存の環境変数で対応可能：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

### 4.5 パフォーマンス要件

| 項目 | 目標値 | 計測方法 |
|------|--------|---------|
| API レスポンス時間 | < 3秒（95パーセンタイル） | Vercel Analytics |
| データベースクエリ | < 100ms | Supabase Dashboard |
| OpenAI API 呼び出し | < 2秒 | ログ計測 |
| 同時接続数 | 100ユーザー | 負荷テスト |

### 4.6 監視・ロギング

#### 4.6.1 ログ項目
```typescript
interface ChatLog {
  timestamp: string;
  user_id: string;
  conversation_id: string;
  message_id: string;
  query_type: string;
  intent: QueryIntent;
  execution_time_ms: number;
  tokens_used: number;
  error?: string;
}
```

#### 4.6.2 アラート条件
| 条件 | アクション |
|------|----------|
| エラー率 > 5% | Slack通知 |
| レスポンス時間 > 5秒 | Slack通知 |
| OpenAI API エラー | Slack通知 + フォールバック |

---

## 5. 非機能要件

### 5.1 可用性
- 目標稼働率: 99.5%
- Vercel + Supabase の SLA に依存

### 5.2 スケーラビリティ
- Vercel Serverless Functions による自動スケール
- Supabase Connection Pooling 活用

### 5.3 保守性
- TypeScript による型安全性
- 単体テスト: Jest + React Testing Library
- E2E テスト: Playwright

### 5.4 データ保持期間
| データ | 保持期間 |
|--------|---------|
| 会話履歴 | 1年 |
| 使用量ログ | 3年 |

---

## 6. 実装フェーズ

### Phase 1: 基盤構築
- [ ] データベーステーブル作成
- [ ] 基本API（/api/chat）実装
- [ ] 意図解析プロンプト作成
- [ ] 基本的なクエリビルダー実装

### Phase 2: フロントエンド
- [ ] ChatWidget コンポーネント
- [ ] メッセージ表示・入力UI
- [ ] ローディング・エラー状態
- [ ] IME対応入力

### Phase 3: クエリ拡張
- [ ] 全クエリタイプの実装
- [ ] 比較機能
- [ ] グラフ表示

### Phase 4: 品質向上
- [ ] テスト作成
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

---

## 7. 付録

### 7.1 質問例とクエリタイプマッピング

| 質問例 | query_type | 備考 |
|--------|-----------|------|
| 今月の経費はいくら？ | expense_summary | current_month |
| 先月の売上教えて | sales_summary | last_month |
| PHOTO部門の経費内訳 | expense_by_category | department=PHOTO |
| 未入金の売上リスト | sales_unpaid | status=UNPAID |
| くらしのマーケットの売上 | sales_by_channel | channel=PLATFORM_KURASHI |
| 今年度の収支 | profit_loss | current_fiscal_year |
| 交通費いくら使った？ | expense_by_category | account_item=旅費交通費 |
| 口座残高 | bank_balance | 全口座 |

### 7.2 用語集

| 用語 | 説明 |
|------|------|
| Intent | ユーザーの質問から抽出された意図・パラメータ |
| QueryBuilder | Intent を Supabase クエリに変換するモジュール |
| QueryResult | クエリ実行結果の構造化データ |
| Conversation | 一連の会話のまとまり |

---

**文書履歴**
| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2024-12-19 | 初版作成 |
