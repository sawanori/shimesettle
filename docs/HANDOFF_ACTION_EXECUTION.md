# チャットアクション実行機能 - 実装完了ドキュメント

## 概要
チャットで「電車代1500円を登録して」のように入力すると、経費や売上をデータベースに直接登録できる機能。

## ステータス: ✅ 完了

## 実装済みの部分

### 1. 型定義 (`lib/chat/types.ts`)
- `ActionType`: `'register_expense' | 'register_sale' | 'query'`
- `ExpenseData`: 経費登録に必要なデータ構造
- `SaleData`: 売上登録に必要なデータ構造
- `ActionIntent`: アクション意図（どのアクションを実行するか）
- `ActionResult`: アクション実行結果

### 2. バリデーションスキーマ (`lib/chat/schemas.ts`)
- `ExpenseDataSchema`: 経費データのZodスキーマ
- `SaleDataSchema`: 売上データのZodスキーマ
- `ActionIntentSchema`: アクション意図のZodスキーマ（`.nullish()`で`null`を許容するよう修正済み）

### 3. アクション分類器 (`lib/chat/intentClassifier.ts`)
- `classifyAction()`: ユーザーメッセージからアクション意図を解析
- GPT-5-miniを使用してJSON形式で意図を抽出
- 不要なデータをクリーンアップする処理を追加

### 4. アクション実行器 (`lib/chat/actionExecutor.ts`) - 新規作成
- `ActionExecutor`クラス
- `registerExpense()`: 経費をSupabaseに登録
- `registerSale()`: 売上を登録（くらしのマーケットの場合は手数料も自動登録）
- 成功メッセージのフォーマット処理

### 5. APIルート (`app/api/chat/route.ts`)
- `classifyAction()`を呼び出してアクション分類
- `action_type`が`register_expense`または`register_sale`で`confidence >= 0.7`の場合、`ActionExecutor`を使用
- それ以外は既存のクエリフローを実行

## 解決済みの問題

### 症状（解決前）
OpenAI APIからのレスポンスが空で返ってきていた。

```
[ActionClassifier] OpenAI response:
[ActionClassifier] No content, using default
```

### 根本原因
GPT-5-miniは内部推論（reasoning tokens）を使用するモデル。
`max_completion_tokens: 500`では、すべてのトークンが推論に消費され、実際の出力に使えるトークンが残っていなかった。

```json
{
  "finish_reason": "length",
  "completion_tokens_details": {
    "reasoning_tokens": 500  // ← すべてのトークンが推論に使われていた
  }
}
```

### 解決策
`max_completion_tokens`を`500`から`2000`に増加。

```typescript
// lib/chat/intentClassifier.ts, lib/chat/responseGenerator.ts
max_completion_tokens: 2000,  // GPT-5-miniは推論トークンを使用するため増加
```

## テストコマンド

```bash
# アクション実行テスト
npx playwright test e2e/chat-action.spec.ts --headed

# 既存のチャットテスト（モック使用）
npx playwright test e2e/chat.spec.ts --headed
```

## 使用例

### 経費登録
```
ユーザー: 電車代1500円を登録して
AI: 経費を登録しました
    ・日付: 2025/12/19
    ・金額: ¥1,500
    ・勘定科目: 旅費交通費
    ・部門: 共通
    ・摘要: 電車代
```

### 売上登録
```
ユーザー: 田中様から5万円の売上を登録して
AI: 売上を登録しました
    ・日付: 2025/12/19
    ・金額: ¥50,000
    ・取引先: 田中様
    ・チャネル: 直接営業
    ・部門: 共通
    ・ステータス: 入金済み
```
