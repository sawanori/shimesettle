-- ============================================
-- NonTurn決算申告 Database Schema
-- ひとり社長向け経営管理アプリ
-- ============================================

-- ============================================
-- 1. Enum型の定義
-- ============================================

-- 事業区分 (Department)
CREATE TYPE department AS ENUM (
  'PHOTO',   -- 写真撮影
  'VIDEO',   -- 動画撮影
  'WEB',     -- WEB開発
  'COMMON'   -- 共通
);

-- ============================================
-- 2. テーブル定義
-- ============================================

-- 経費テーブル (expenses)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  transaction_date DATE NOT NULL,
  amount INTEGER NOT NULL,
  department department NOT NULL,
  account_item TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'UNCONFIRMED' NOT NULL,
  ai_check_status TEXT DEFAULT 'PENDING',
  ai_audit_note TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 売上チャネル (Sales Channel)
CREATE TYPE sales_channel AS ENUM (
  'DIRECT',           -- 直接営業
  'REFERRAL',         -- 紹介
  'SNS',              -- SNS経由
  'WEBSITE',          -- ウェブサイト経由
  'PLATFORM_KURASHI', -- プラットフォーム（くらしのマーケット）
  'PLATFORM_TOTTA',   -- プラットフォーム（Totta）
  'REPEAT',           -- リピート
  'OTHER'             -- その他
);

-- 売上テーブル (sales)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  transaction_date DATE NOT NULL,
  amount INTEGER NOT NULL,
  fee_amount INTEGER,                    -- 手数料金額（円）
  fee_rate DECIMAL(5,2),                 -- 手数料率（%）
  net_amount INTEGER,                    -- 手取り金額（手数料控除後）
  department department NOT NULL,
  client_name TEXT NOT NULL,
  channel sales_channel DEFAULT 'DIRECT',
  status TEXT DEFAULT 'UNPAID' NOT NULL,
  file_path TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================
-- 3. インデックス作成
-- ============================================

-- 経費テーブルのインデックス
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_transaction_date ON expenses(transaction_date);
CREATE INDEX idx_expenses_department ON expenses(department);

-- 売上テーブルのインデックス
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_transaction_date ON sales(transaction_date);
CREATE INDEX idx_sales_department ON sales(department);
CREATE INDEX idx_sales_channel ON sales(channel);
CREATE INDEX idx_sales_status ON sales(status);

-- ============================================
-- 4. Row Level Security (RLS) の有効化
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLSポリシーの作成
-- ============================================

-- expenses テーブルのポリシー
CREATE POLICY "Users can view their own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

-- sales テーブルのポリシー
CREATE POLICY "Users can view their own sales"
  ON sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales"
  ON sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales"
  ON sales FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales"
  ON sales FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 6. コメント（テーブル・カラム説明）
-- ============================================

COMMENT ON TABLE expenses IS '経費テーブル - 事業経費の記録';
COMMENT ON COLUMN expenses.id IS '経費ID（UUID）';
COMMENT ON COLUMN expenses.created_at IS 'レコード作成日時';
COMMENT ON COLUMN expenses.transaction_date IS '取引日';
COMMENT ON COLUMN expenses.amount IS '税込金額（円）';
COMMENT ON COLUMN expenses.department IS '事業区分';
COMMENT ON COLUMN expenses.account_item IS '勘定科目';
COMMENT ON COLUMN expenses.description IS '摘要・メモ';
COMMENT ON COLUMN expenses.file_path IS '領収書ファイルパス（Supabase Storage）';
COMMENT ON COLUMN expenses.status IS '確認ステータス（UNCONFIRMED/CONFIRMED）';
COMMENT ON COLUMN expenses.ai_check_status IS 'AI監査ステータス（OK/WARNING/PENDING）';
COMMENT ON COLUMN expenses.ai_audit_note IS 'AIからの指摘コメント';
COMMENT ON COLUMN expenses.user_id IS 'ユーザーID（auth.users参照）';

COMMENT ON TABLE sales IS '売上テーブル - 売上の記録';
COMMENT ON COLUMN sales.id IS '売上ID（UUID）';
COMMENT ON COLUMN sales.created_at IS 'レコード作成日時';
COMMENT ON COLUMN sales.transaction_date IS '売上計上日';
COMMENT ON COLUMN sales.amount IS '売上金額（円）';
COMMENT ON COLUMN sales.department IS '事業区分';
COMMENT ON COLUMN sales.client_name IS '取引先名';
COMMENT ON COLUMN sales.channel IS '受注チャネル（直接/紹介/SNS/ウェブ/くらしのマーケット/Totta/リピート/その他）';
COMMENT ON COLUMN sales.fee_amount IS '手数料金額（円）';
COMMENT ON COLUMN sales.fee_rate IS '手数料率（%）';
COMMENT ON COLUMN sales.net_amount IS '手取り金額（手数料控除後）';
COMMENT ON COLUMN sales.status IS '入金ステータス（UNPAID/PAID）';
COMMENT ON COLUMN sales.file_path IS '請求書ファイルパス（Supabase Storage）';
COMMENT ON COLUMN sales.user_id IS 'ユーザーID（auth.users参照）';

-- ============================================
-- 7. 銀行口座関連テーブル
-- ============================================

-- 銀行種別 (Bank Type)
CREATE TYPE bank_type AS ENUM (
  'MUFG',       -- 三菱UFJ銀行
  'SMBC',       -- 三井住友銀行
  'MIZUHO',     -- みずほ銀行
  'YUCHO',      -- ゆうちょ銀行
  'RAKUTEN',    -- 楽天銀行
  'PAYPAY',     -- PayPay銀行
  'GMO_AOZORA', -- GMOあおぞらネット銀行
  'OTHER'       -- その他
);

-- 口座カテゴリ (Account Category)
CREATE TYPE account_category AS ENUM (
  'BUSINESS',   -- 事業用
  'PERSONAL'    -- 個人用
);

-- 銀行口座テーブル (bank_accounts)
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  name TEXT NOT NULL,                    -- 口座名（表示用）
  bank_type bank_type NOT NULL,          -- 銀行種別
  bank_name TEXT NOT NULL,               -- 銀行名
  branch_name TEXT,                      -- 支店名
  account_number TEXT,                   -- 口座番号（下4桁など）
  initial_balance INTEGER DEFAULT 0,     -- 開始残高
  is_active BOOLEAN DEFAULT TRUE,        -- 有効フラグ
  category account_category DEFAULT 'BUSINESS' NOT NULL,  -- 口座カテゴリ
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 銀行取引テーブル (bank_transactions)
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,        -- 取引日
  description TEXT NOT NULL,             -- 摘要
  withdrawal INTEGER DEFAULT 0,          -- 出金額
  deposit INTEGER DEFAULT 0,             -- 入金額
  balance INTEGER,                       -- 残高（CSVにある場合）
  import_hash TEXT,                      -- 重複チェック用ハッシュ
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,  -- 紐付け経費
  linked_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,        -- 紐付け売上
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================
-- 8. 銀行関連インデックス
-- ============================================

CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_category ON bank_accounts(category);
CREATE INDEX idx_bank_transactions_user_id ON bank_transactions(user_id);
CREATE INDEX idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_transaction_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_import_hash ON bank_transactions(import_hash);

-- ============================================
-- 9. 銀行関連RLS
-- ============================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- bank_accounts ポリシー
CREATE POLICY "Users can view their own bank_accounts"
  ON bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank_accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank_accounts"
  ON bank_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank_accounts"
  ON bank_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- bank_transactions ポリシー
CREATE POLICY "Users can view their own bank_transactions"
  ON bank_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank_transactions"
  ON bank_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank_transactions"
  ON bank_transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank_transactions"
  ON bank_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 10. 銀行関連コメント
-- ============================================

COMMENT ON TABLE bank_accounts IS '銀行口座マスタ';
COMMENT ON COLUMN bank_accounts.name IS '口座の表示名';
COMMENT ON COLUMN bank_accounts.bank_type IS '銀行種別（CSVパーサー選択用）';
COMMENT ON COLUMN bank_accounts.initial_balance IS 'CSV取込開始時点の残高';
COMMENT ON COLUMN bank_accounts.category IS '口座カテゴリ（BUSINESS=事業用, PERSONAL=個人用）';

COMMENT ON TABLE bank_transactions IS '銀行取引明細';
COMMENT ON COLUMN bank_transactions.import_hash IS '重複インポート防止用ハッシュ';
COMMENT ON COLUMN bank_transactions.linked_expense_id IS '紐付いた経費レコード';
COMMENT ON COLUMN bank_transactions.linked_sale_id IS '紐付いた売上レコード';

-- ============================================
-- 11. CSVインポート履歴テーブル
-- ============================================

-- CSVインポート履歴テーブル (csv_imports)
CREATE TABLE csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  records_count INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX idx_csv_imports_user_id ON csv_imports(user_id);
CREATE INDEX idx_csv_imports_bank_account_id ON csv_imports(bank_account_id);

-- RLS有効化
ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view their own csv_imports"
  ON csv_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own csv_imports"
  ON csv_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own csv_imports"
  ON csv_imports FOR DELETE
  USING (auth.uid() = user_id);

-- コメント
COMMENT ON TABLE csv_imports IS 'CSVインポート履歴';
COMMENT ON COLUMN csv_imports.file_path IS 'Supabase Storageのファイルパス';
COMMENT ON COLUMN csv_imports.file_name IS '元のファイル名';
COMMENT ON COLUMN csv_imports.records_count IS 'インポートされたレコード数';
