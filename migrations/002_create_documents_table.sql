-- 証明書類テーブル作成
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    description TEXT,
    issue_date DATE,
    expiry_date DATE,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLSを有効化
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のドキュメントのみ操作可能
CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_issue_date ON documents(issue_date);

-- ストレージバケット作成（Supabase Dashboardで実行するか、別途API経由で作成）
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
