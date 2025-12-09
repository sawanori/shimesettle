# セキュリティ監査レポート

**実施日**: 2025-12-08
**担当**: Claude (Security Auditor)
**ステータス**: 完了

---

## 監査結果サマリー

| カテゴリ | ステータス | 詳細 |
|---------|----------|------|
| 環境変数の管理 | ✅ 安全 | .env.local はgitignoreに含まれている |
| APIキーの露出 | ✅ 安全 | OPENAI_API_KEYはサーバーサイドのみで使用 |
| クライアントサイドコード | ✅ 安全 | 機密情報の露出なし |
| Supabase認証 | ✅ 安全 | ANON_KEYは公開可能（RLSで保護） |
| 銀行明細データ | ⚠️ 要対応 | CSVファイルがプロジェクト内に存在 |
| Middleware保護 | ⚠️ 要確認 | /api/analyze-invoiceが保護リストにない |

---

## 詳細分析

### 1. 環境変数の使用状況

#### サーバーサイド（安全）
```
OPENAI_API_KEY - app/api/analyze-invoice/route.ts (サーバーのみ)
OPENAI_API_KEY - app/api/analyze-receipt/route.ts (サーバーのみ)
```

#### クライアントサイド公開可能（NEXT_PUBLIC_）
```
NEXT_PUBLIC_SUPABASE_URL - Supabase プロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY - 匿名キー（RLSで保護されているため公開可）
```

**結論**: `OPENAI_API_KEY` はサーバーサイドのAPI routeでのみ使用されており、クライアントに露出しません。

---

### 2. APIキー保護状況

| キー | 使用場所 | ビルド出力に含まれるか | リスク |
|-----|---------|---------------------|-------|
| `OPENAI_API_KEY` | API Routes | ❌ 含まれない | なし |
| `NEXT_PUBLIC_SUPABASE_URL` | Client/Server | ✅ 含まれる | 許容（公開情報） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client/Server | ✅ 含まれる | 許容（RLS保護） |

**注意**: `NEXT_PUBLIC_` プレフィックスのない環境変数は、Next.jsによって自動的にサーバーサイドのみに制限されます。

---

### 3. ハードコードされたシークレット

検索パターン: `sk-`, `eyJ`, `Bearer `, `Authorization:`

**結果**: ハードコードされたAPIキーやトークンは検出されませんでした。

---

### 4. Git履歴の確認

```
.env* - gitignoreに含まれている ✅
シークレットファイル - Git履歴になし ✅
```

---

## 発見された問題

### 問題1: 銀行明細CSVファイル（重大度: 高）

**ファイル**: `statement-102-1-1473809.csv`

**内容**: 実際の銀行取引データ（日付、金額、残高など）

**リスク**: このファイルがGitにコミットされると、個人の金融情報が公開リポジトリに露出する可能性があります。

**推奨対応**:
1. このファイルを削除する
2. `.gitignore` に `*.csv` を追加する

---

### 問題2: Middleware保護の不整合（重大度: 中）

**現状**: `/api/analyze-invoice` が `PROTECTED_API_PATHS` に含まれていない

**middleware.ts の現在の設定**:
```typescript
const PROTECTED_API_PATHS = [
    '/api/analyze-receipt',
    '/api/export-csv',
    '/api/bank',
    '/api/sales',
];
// /api/analyze-invoice が欠けている
```

**影響**: `/api/analyze-invoice` はMiddlewareレベルでの認証チェックがありませんが、**APIルート内で個別に認証チェックを実装しているため、実際のセキュリティリスクは低い**です。

**推奨対応**: 一貫性のため、`/api/analyze-invoice` を `PROTECTED_API_PATHS` に追加

---

### 問題3: テスト成果物の管理（重大度: 低）

**ファイル/フォルダ**:
- `playwright-report/`
- `test-results/`

**リスク**: スクリーンショットやテストログに機密情報が含まれる可能性

**推奨対応**: `.gitignore` に以下を追加
```
playwright-report/
test-results/
```

---

## 推奨 .gitignore 追記

```gitignore
# 銀行明細などの個人データ
*.csv
!sample*.csv

# テスト成果物
playwright-report/
test-results/

# その他の機密ファイル
*.pem
*.key
credentials*.json
```

---

## APIルートの認証状況

| エンドポイント | Middleware保護 | ルート内認証 | 総合評価 |
|--------------|---------------|-------------|---------|
| `/api/analyze-invoice` | ❌ | ✅ | ✅ 安全 |
| `/api/analyze-receipt` | ✅ | ✅ | ✅ 安全 |
| `/api/export-csv` | ✅ | ✅ | ✅ 安全 |
| `/api/sales/import-csv` | ✅ | ✅ | ✅ 安全 |
| `/api/bank/import-csv` | ✅ | ✅ | ✅ 安全 |
| `/api/bank/download-csv` | ✅ | N/A | ✅ 安全 |

全てのAPIルートはルート内で認証チェックを実装しているため、Middlewareの設定に関わらずセキュリティは確保されています。

---

## Next.js ビルド出力の確認

`next.config.ts` に環境変数の露出設定はありません:
```typescript
const nextConfig: NextConfig = {
  /* config options here */
};
```

**結論**: `OPENAI_API_KEY` などのサーバーサイド環境変数がクライアントバンドルに含まれるリスクはありません。

---

## デプロイ時のチェックリスト

### 必須
- [ ] `.env.local` がデプロイに含まれていないこと
- [ ] `statement-*.csv` などの個人データファイルを削除
- [ ] 本番用の環境変数をホスティングプラットフォームで設定

### 推奨
- [ ] `.gitignore` に `*.csv` を追加
- [ ] Middleware の `PROTECTED_API_PATHS` に `/api/analyze-invoice` を追加
- [ ] `playwright-report/` と `test-results/` を `.gitignore` に追加

---

## 結論

**全体評価**: ✅ デプロイ可能（軽微な修正推奨）

主要なセキュリティ対策は適切に実装されています:

1. **APIキーの保護**: `OPENAI_API_KEY` はサーバーサイドのみで使用
2. **認証**: 全APIルートで認証チェックを実装
3. **SSRF対策**: URL検証によりSSRF攻撃を防止
4. **レート制限**: ユーザーごとのレート制限を実装
5. **RLS**: Supabaseの行レベルセキュリティでデータ保護

**即座の対応が必要な項目**:
- `statement-102-1-1473809.csv` の削除（個人金融データ）

---

## 付録: セキュリティ機能の実装箇所

| 機能 | ファイル |
|------|---------|
| SSRF対策 | `lib/api-security.ts` |
| レート制限 | `lib/api-security.ts` |
| 認証チェック | `middleware.ts`, 各APIルート |
| CSVインジェクション対策 | `app/api/export-csv/route.ts` |
| Zodスキーマ検証 | `lib/schemas.ts` |
