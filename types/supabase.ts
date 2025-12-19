/**
 * NonTurn決算申告 - Supabase Database Types
 * ひとり社長向け経営管理アプリ
 *
 * このファイルはデータベーススキーマに基づいて手動で作成されています。
 * スキーマ変更後は `supabase gen types typescript` で再生成してください。
 */

// ============================================
// Enum型定義
// ============================================

/**
 * 事業区分
 */
export type Department = 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON';

/**
 * 経費確認ステータス
 */
export type ExpenseStatus = 'UNCONFIRMED' | 'CONFIRMED';

/**
 * AI監査ステータス
 */
export type AiCheckStatus = 'OK' | 'WARNING' | 'PENDING';

/**
 * 売上入金ステータス
 */
export type SalesStatus = 'UNPAID' | 'PAID';

/**
 * 銀行種別
 */
export type BankType = 'MUFG' | 'SMBC' | 'MIZUHO' | 'YUCHO' | 'RAKUTEN' | 'PAYPAY' | 'GMO_AOZORA' | 'RAKUTEN_CARD' | 'AMEX' | 'OTHER_CARD' | 'OTHER';

/**
 * 売上チャネル
 */
export type SalesChannel = 'DIRECT' | 'REFERRAL' | 'SNS' | 'WEBSITE' | 'PLATFORM_KURASHI' | 'PLATFORM_TOTTA' | 'REPEAT' | 'OTHER';

/**
 * 口座カテゴリ
 */
export type AccountCategory = 'BUSINESS' | 'PERSONAL';

/**
 * 口座種別 (銀行口座 / クレジットカード)
 */
export type AccountType = 'BANK' | 'CREDIT_CARD';

// ============================================
// Database Interface (supabase gen types 互換)
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string;
          created_at: string;
          transaction_date: string;
          amount: number;
          department: Department;
          account_item: string;
          description: string | null;
          file_path: string | null;
          folder_number: string | null;
          status: string;
          ai_check_status: string | null;
          ai_audit_note: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          transaction_date: string;
          amount: number;
          department: Department;
          account_item: string;
          description?: string | null;
          file_path?: string | null;
          folder_number?: string | null;
          status?: string;
          ai_check_status?: string | null;
          ai_audit_note?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          transaction_date?: string;
          amount?: number;
          department?: Department;
          account_item?: string;
          description?: string | null;
          file_path?: string | null;
          folder_number?: string | null;
          status?: string;
          ai_check_status?: string | null;
          ai_audit_note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      sales: {
        Row: {
          id: string;
          created_at: string;
          transaction_date: string;
          amount: number;
          fee_amount: number | null;
          fee_rate: number | null;
          net_amount: number | null;
          department: Department;
          client_name: string;
          channel: SalesChannel | null;
          status: string;
          file_path: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          transaction_date: string;
          amount: number;
          fee_amount?: number | null;
          fee_rate?: number | null;
          net_amount?: number | null;
          department: Department;
          client_name: string;
          channel?: SalesChannel | null;
          status?: string;
          file_path?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          transaction_date?: string;
          amount?: number;
          fee_amount?: number | null;
          fee_rate?: number | null;
          net_amount?: number | null;
          department?: Department;
          client_name?: string;
          channel?: SalesChannel | null;
          status?: string;
          file_path?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      bank_accounts: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          bank_type: BankType;
          bank_name: string;
          branch_name: string | null;
          account_number: string | null;
          initial_balance: number;
          is_active: boolean;
          category: AccountCategory;
          account_type: AccountType;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          bank_type: BankType;
          bank_name: string;
          branch_name?: string | null;
          account_number?: string | null;
          initial_balance?: number;
          is_active?: boolean;
          category?: AccountCategory;
          account_type?: AccountType;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          bank_type?: BankType;
          bank_name?: string;
          branch_name?: string | null;
          account_number?: string | null;
          initial_balance?: number;
          is_active?: boolean;
          category?: AccountCategory;
          account_type?: AccountType;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bank_accounts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      bank_transactions: {
        Row: {
          id: string;
          created_at: string;
          bank_account_id: string;
          transaction_date: string;
          description: string;
          withdrawal: number;
          deposit: number;
          balance: number | null;
          import_hash: string | null;
          linked_expense_id: string | null;
          linked_sale_id: string | null;
          processing_date: string | null;
          foreign_currency_amount: number | null;
          exchange_rate: number | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          bank_account_id: string;
          transaction_date: string;
          description: string;
          withdrawal?: number;
          deposit?: number;
          balance?: number | null;
          import_hash?: string | null;
          linked_expense_id?: string | null;
          linked_sale_id?: string | null;
          processing_date?: string | null;
          foreign_currency_amount?: number | null;
          exchange_rate?: number | null;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          bank_account_id?: string;
          transaction_date?: string;
          description?: string;
          withdrawal?: number;
          deposit?: number;
          balance?: number | null;
          import_hash?: string | null;
          linked_expense_id?: string | null;
          linked_sale_id?: string | null;
          processing_date?: string | null;
          foreign_currency_amount?: number | null;
          exchange_rate?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bank_transactions_bank_account_id_fkey';
            columns: ['bank_account_id'];
            referencedRelation: 'bank_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bank_transactions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      csv_imports: {
        Row: {
          id: string;
          created_at: string;
          bank_account_id: string;
          file_path: string;
          file_name: string;
          records_count: number;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          bank_account_id: string;
          file_path: string;
          file_name: string;
          records_count?: number;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          bank_account_id?: string;
          file_path?: string;
          file_name?: string;
          records_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'csv_imports_bank_account_id_fkey';
            columns: ['bank_account_id'];
            referencedRelation: 'bank_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'csv_imports_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          created_at: string;
          title: string;
          document_type: string;
          description: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          file_path: string;
          file_name: string;
          file_type: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          document_type: string;
          description?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          file_path: string;
          file_name: string;
          file_type?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          document_type?: string;
          description?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          file_path?: string;
          file_name?: string;
          file_type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_conversations_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          data: Json | null;
          intent: Json | null;
          tokens_used: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          data?: Json | null;
          intent?: Json | null;
          tokens_used?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          content?: string;
          data?: Json | null;
          intent?: Json | null;
          tokens_used?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'chat_conversations';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          request_count: number | null;
          tokens_used: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
          request_count?: number | null;
          tokens_used?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          request_count?: number | null;
          tokens_used?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_usage_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_chat_usage: {
        Args: {
          p_user_id: string;
          p_date: string;
          p_tokens: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      department: Department;
      bank_type: BankType;
      sales_channel: SalesChannel;
      account_category: AccountCategory;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ============================================
// 便利な型エイリアス
// ============================================

/** 経費テーブルの行データ */
export type Expense = Database['public']['Tables']['expenses']['Row'];

/** 経費の新規作成用データ */
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];

/** 経費の更新用データ */
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

/** 売上テーブルの行データ */
export type Sale = Database['public']['Tables']['sales']['Row'];

/** 売上の新規作成用データ */
export type SaleInsert = Database['public']['Tables']['sales']['Insert'];

/** 売上の更新用データ */
export type SaleUpdate = Database['public']['Tables']['sales']['Update'];

/** 銀行口座テーブルの行データ */
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];

/** 銀行口座の新規作成用データ */
export type BankAccountInsert = Database['public']['Tables']['bank_accounts']['Insert'];

/** 銀行口座の更新用データ */
export type BankAccountUpdate = Database['public']['Tables']['bank_accounts']['Update'];

/** 銀行取引テーブルの行データ */
export type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];

/** 銀行取引の新規作成用データ */
export type BankTransactionInsert = Database['public']['Tables']['bank_transactions']['Insert'];

/** 銀行取引の更新用データ */
export type BankTransactionUpdate = Database['public']['Tables']['bank_transactions']['Update'];

/** CSVインポート履歴テーブルの行データ */
export type CsvImport = Database['public']['Tables']['csv_imports']['Row'];

/** CSVインポート履歴の新規作成用データ */
export type CsvImportInsert = Database['public']['Tables']['csv_imports']['Insert'];

/** 参考書類テーブルの行データ */
export type Document = Database['public']['Tables']['documents']['Row'];

/** 参考書類の新規作成用データ */
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

/** 参考書類の更新用データ */
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

/** チャット会話テーブルの行データ */
export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row'];

/** チャット会話の新規作成用データ */
export type ChatConversationInsert = Database['public']['Tables']['chat_conversations']['Insert'];

/** チャットメッセージテーブルの行データ */
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

/** チャットメッセージの新規作成用データ */
export type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert'];

/** チャット使用量テーブルの行データ */
export type ChatUsage = Database['public']['Tables']['chat_usage']['Row'];

// ============================================
// Supabase Client 型付けヘルパー
// ============================================

/**
 * Supabase Clientの型付け用
 *
 * @example
 * import { createClient } from '@supabase/supabase-js';
 * import { Database } from '@/types/supabase';
 *
 * const supabase = createClient<Database>(
 *   process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 * );
 *
 * // 型安全なクエリ
 * const { data } = await supabase
 *   .from('expenses')
 *   .select('*');
 * // data は Expense[] | null として型推論される
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
