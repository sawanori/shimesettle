# Geminiへの指示プロンプト

以下のプロンプトをコピーしてGeminiに送信してください。

---

## 初回指示プロンプト（プロジェクト開始時）

```
あなたはShimeSettleプロジェクトのAIチャット機能開発を担当するエンジニアです。

## プロジェクト情報
- リポジトリ: ShimeSettle（経費・売上管理アプリ）
- 技術スタック: Next.js 15, React 19, TypeScript, Tailwind CSS 4, Supabase

## あなたの役割
担当AI (B) として、以下のタスクを実装してください：
- TypeScript型定義・Zodスキーマ
- プロンプト文作成
- ユーティリティ関数
- Reactコンポーネント（ChatWidget等）
- カスタムフック
- テスト

## 作業指示書
`docs/requirements/gemini-instructions.md` に詳細な実装仕様があります。
このファイルを読み込んで、指示に従って実装を進めてください。

## 今回の作業
Week 1 のタスクから開始します：
1. CHAT-016: QueryIntent 型定義
2. CHAT-017: ChatRequest / ChatResponse 型定義
3. CHAT-018: QueryResult 型定義
4. CHAT-019: ChatError 型・定数定義
5. CHAT-011: リクエストバリデーション（Zodスキーマ）
6. CHAT-012: エラーハンドリング共通化
7. CHAT-020: 意図解析プロンプト作成
8. CHAT-022: 時間表現パーサー実装
9. CHAT-023: プロンプトインジェクション対策

## 出力形式
各チケットについて：
1. ファイルパスを明示
2. 完全なTypeScriptコードを出力
3. 簡潔な実装説明

まず `docs/requirements/gemini-instructions.md` を読んで、作業を開始してください。
```

---

## Week 2 開始時のプロンプト

```
Week 1 の作業お疲れ様でした。Week 2 のタスクを開始します。

## 今回の作業
1. CHAT-026: 日付範囲計算ユーティリティ
2. CHAT-037: 回答生成プロンプト作成
3. CHAT-039: 金額フォーマットユーティリティ

## 参照ファイル
- 指示書: `docs/requirements/gemini-instructions.md`
- 既存の fiscalYear.ts: `lib/fiscalYear.ts`

Week 1 で作成した `lib/chat/types.ts` と `lib/chat/utils.ts` に追記する形で実装してください。
```

---

## Week 3 開始時のプロンプト

```
Week 2 の作業お疲れ様でした。Week 3 のタスクを開始します。

## 今回の作業（フロントエンドコンポーネント）
1. CHAT-041: ChatWidget コンポーネント（開閉制御）
2. CHAT-042: ChatContainer コンポーネント
3. CHAT-043: ChatHeader コンポーネント
4. CHAT-044: ChatMessages コンポーネント
5. CHAT-045: ChatMessage コンポーネント（AI/User）
6. CHAT-046: ChatInput コンポーネント（IME対応）
7. CHAT-047: ChatSuggestions コンポーネント
8. CHAT-048: DataTable コンポーネント（表形式表示）

## 配置場所
`components/chat/` ディレクトリに各コンポーネントを作成

## 注意点
- 'use client' ディレクティブを忘れずに
- IME対応（日本語入力）を考慮
- Tailwind CSS でスタイリング
- lucide-react でアイコン使用

指示書の「3.3 Week 3: フロントエンドコンポーネント」を参照して実装してください。
```

---

## Week 4 開始時のプロンプト

```
Week 3 の作業お疲れ様でした。最終 Week 4 のタスクを開始します。

## 今回の作業
1. CHAT-049: useChatMessages カスタムフック
2. CHAT-050: チャット状態の永続化（localStorage）
3. CHAT-015: GET /api/chat/suggestions エンドポイント
4. CHAT-052: E2E テスト作成（Playwright）
5. CHAT-053: パフォーマンス計測・最適化

## 配置場所
- フック: `hooks/useChatMessages.ts`
- API: `app/api/chat/suggestions/route.ts`
- テスト: `e2e/chat.spec.ts`

## 注意点
- useChatMessages は Week 3 で作成したコンポーネントと連携
- localStorage への保存は最新50件まで
- E2E テストは Playwright を使用

指示書の「3.4 Week 4: フック・テスト」を参照して実装してください。
```

---

## 個別タスク依頼のプロンプト（例）

```
CHAT-045: ChatMessage コンポーネントを実装してください。

## 要件
- ユーザーとAIのメッセージを区別して表示
- role に応じた左右配置（AI: 左、User: 右）
- アバターアイコン表示
- data がある場合は DataTable を表示

## ファイル
`components/chat/ChatMessage.tsx`

## 参照
`docs/requirements/gemini-instructions.md` の CHAT-045 セクション
```

---

## 確認・レビュー依頼のプロンプト

```
以下のファイルを作成しました。コードレビューをお願いします。

## レビュー対象
- lib/chat/types.ts
- lib/chat/schemas.ts
- lib/chat/errors.ts

## 確認ポイント
1. 型定義に漏れがないか
2. Zodスキーマが適切か
3. エラーメッセージが日本語で適切か
4. コーディング規約に沿っているか
```

---

## トラブルシューティング用プロンプト

```
以下のエラーが発生しています。修正方法を教えてください。

## エラー内容
[エラーメッセージをここに貼り付け]

## 該当ファイル
[ファイルパス]

## 関連チケット
CHAT-XXX
```
