import { z } from 'zod';

export const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'メッセージを入力してください')
    .max(500, 'メッセージは500文字以内で入力してください'),
  conversationId: z.string().uuid().nullish(),
  context: z
    .object({
      fiscalYear: z.number().int().min(2020).max(2100).optional(),
      department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']).optional(),
    })
    .optional(),
});

export function validateChatRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}

// QueryIntent のバリデーションスキーマ
export const QueryIntentSchema = z.object({
  query_type: z.enum([
    'expense_summary',
    'expense_detail',
    'expense_by_category',
    'expense_by_department',
    'sales_summary',
    'sales_detail',
    'sales_by_channel',
    'sales_by_department',
    'sales_unpaid',
    'bank_balance',
    'bank_transactions',
    'cashflow_summary',
    'profit_loss',
    'comparison',
    'general',
    'unknown',
  ]),
  time_range: z.object({
    type: z.enum(['current_month', 'last_month', 'current_fiscal_year', 'custom', 'all']),
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
  }),
  filters: z.object({
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']).nullable(),
    account_item: z.string().nullable(),
    channel: z.enum([
      'DIRECT',
      'REFERRAL',
      'SNS',
      'WEBSITE',
      'PLATFORM_KURASHI',
      'PLATFORM_TOTTA',
      'REPEAT',
      'OTHER',
    ]).nullable(),
    status: z.enum(['PAID', 'UNPAID']).nullable(),
    bank_account_id: z.string().uuid().nullable(),
  }),
  aggregation: z.object({
    group_by: z.enum(['department', 'account_item', 'channel', 'month']).nullable(),
    sort_by: z.enum(['amount', 'date']).nullable(),
    sort_order: z.enum(['asc', 'desc']).nullable(),
    limit: z.number().int().positive().nullable(),
  }),
  comparison: z.object({
    enabled: z.boolean(),
    compare_to: z.enum(['previous_month', 'previous_year']).nullable(),
  }),
});

export type ValidatedQueryIntent = z.infer<typeof QueryIntentSchema>;

// ExpenseData スキーマ
export const ExpenseDataSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください'),
  amount: z.number().positive('金額は正の数で入力してください'),
  account_item: z.string().min(1, '勘定科目を入力してください'),
  department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']),
  description: z.string().optional(),
});

// SaleData スキーマ
export const SaleDataSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください'),
  amount: z.number().positive('金額は正の数で入力してください'),
  client_name: z.string().min(1, '取引先名を入力してください'),
  department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']),
  channel: z.enum(['DIRECT', 'REFERRAL', 'SNS', 'WEBSITE', 'PLATFORM_KURASHI', 'PLATFORM_TOTTA', 'REPEAT', 'OTHER']),
  status: z.enum(['PAID', 'UNPAID']),
  description: z.string().optional(),
});

// ActionIntent スキーマ
export const ActionIntentSchema = z.object({
  action_type: z.enum(['register_expense', 'register_sale', 'query']),
  expense_data: ExpenseDataSchema.nullish(),
  sale_data: SaleDataSchema.nullish(),
  confidence: z.number().min(0).max(1),
});

export type ValidatedActionIntent = z.infer<typeof ActionIntentSchema>;
