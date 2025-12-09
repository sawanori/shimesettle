-- ============================================
-- Migration: Add account_category to bank_accounts
-- Date: 2025-12-08
-- Description: ビジネス/個人口座の分離機能を追加
-- ============================================

-- 1. 口座カテゴリの列挙型を作成
CREATE TYPE account_category AS ENUM ('BUSINESS', 'PERSONAL');

-- 2. bank_accounts テーブルにカラム追加
-- 既存のレコードは全てBUSINESSとして扱う
ALTER TABLE bank_accounts
ADD COLUMN category account_category DEFAULT 'BUSINESS' NOT NULL;

-- 3. インデックス追加（フィルタリング高速化）
CREATE INDEX idx_bank_accounts_category ON bank_accounts(category);

-- 4. コメント追加
COMMENT ON COLUMN bank_accounts.category IS '口座カテゴリ（BUSINESS=事業用, PERSONAL=個人用）';

-- ============================================
-- 確認用クエリ
-- ============================================
-- SELECT * FROM bank_accounts;
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'bank_accounts';
