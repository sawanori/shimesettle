export type QueryType =
  | 'expense_summary'
  | 'expense_detail'
  | 'expense_by_category'
  | 'expense_by_department'
  | 'sales_summary'
  | 'sales_detail'
  | 'sales_by_channel'
  | 'sales_by_department'
  | 'sales_unpaid'
  | 'bank_balance'
  | 'bank_transactions'
  | 'cashflow_summary'
  | 'profit_loss'
  | 'comparison'
  | 'general'
  | 'unknown';

export interface TimeRange {
  type: 'current_month' | 'last_month' | 'current_fiscal_year' | 'custom' | 'all';
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
}

export interface QueryFilters {
  department: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON' | null;
  account_item: string | null;
  channel:
  | 'DIRECT'
  | 'REFERRAL'
  | 'SNS'
  | 'WEBSITE'
  | 'PLATFORM_KURASHI'
  | 'PLATFORM_TOTTA'
  | 'REPEAT'
  | 'OTHER'
  | null;
  status: 'PAID' | 'UNPAID' | null;
  bank_account_id: string | null;
}

export interface QueryAggregation {
  group_by: 'department' | 'account_item' | 'channel' | 'month' | null;
  sort_by: 'amount' | 'date' | null;
  sort_order: 'asc' | 'desc' | null;
  limit: number | null;
}

export interface QueryComparison {
  enabled: boolean;
  compare_to: 'previous_month' | 'previous_year' | null;
}

export interface QueryIntent {
  query_type: QueryType;
  time_range: TimeRange;
  filters: QueryFilters;
  aggregation: QueryAggregation;
  comparison: QueryComparison;
}

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

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    fiscalYear?: number;
    department?: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON';
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: QueryResult;
  timestamp: string; // ISO 8601
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  suggestions?: string[];
}

// アクション関連の型定義
export type ActionType = 'register_expense' | 'register_sale' | 'query';

export interface ExpenseData {
  transaction_date: string;
  amount: number;
  account_item: string;
  department: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON';
  description?: string;
}

export interface SaleData {
  transaction_date: string;
  amount: number;
  client_name: string;
  department: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON';
  channel: 'DIRECT' | 'REFERRAL' | 'SNS' | 'WEBSITE' | 'PLATFORM_KURASHI' | 'PLATFORM_TOTTA' | 'REPEAT' | 'OTHER';
  status: 'PAID' | 'UNPAID';
  description?: string;
}

export interface ActionIntent {
  action_type: ActionType;
  expense_data?: ExpenseData;
  sale_data?: SaleData;
  query_intent?: QueryIntent;
  confidence: number; // 0-1の確信度
}

export interface ActionResult {
  success: boolean;
  action_type: ActionType;
  message: string;
  data?: Record<string, unknown>;
}
