import { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentFiscalYear, getFiscalYearRange } from '@/lib/fiscalYear';
import type { QueryIntent, QueryResult, TimeRange } from './types';

export class FinancialQueryBuilder {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * QueryIntentに基づいてクエリを実行
   */
  async execute(intent: QueryIntent): Promise<QueryResult> {
    switch (intent.query_type) {
      case 'expense_summary':
        return this.getExpenseSummary(intent);
      case 'expense_by_category':
        return this.getExpenseByCategory(intent);
      case 'expense_by_department':
        return this.getExpenseByDepartment(intent);
      case 'expense_detail':
        return this.getExpenseDetail(intent);
      case 'sales_summary':
        return this.getSalesSummary(intent);
      case 'sales_by_channel':
        return this.getSalesByChannel(intent);
      case 'sales_by_department':
        return this.getSalesByDepartment(intent);
      case 'sales_unpaid':
        return this.getUnpaidSales(intent);
      case 'sales_detail':
        return this.getSalesDetail(intent);
      case 'bank_balance':
        return this.getBankBalance(intent);
      case 'profit_loss':
        return this.getProfitLoss(intent);
      case 'general':
      case 'unknown':
      default:
        return this.getGeneralSummary(intent);
    }
  }

  /**
   * 時間範囲から日付範囲を計算
   */
  private getDateRange(timeRange: TimeRange): { start: string; end: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    switch (timeRange.type) {
      case 'current_month': {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return {
          start: this.formatDate(start),
          end: this.formatDate(end),
        };
      }
      case 'last_month': {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return {
          start: this.formatDate(start),
          end: this.formatDate(end),
        };
      }
      case 'current_fiscal_year': {
        const fiscalYear = getCurrentFiscalYear();
        return getFiscalYearRange(fiscalYear);
      }
      case 'custom': {
        return {
          start: timeRange.start_date || this.formatDate(new Date(year, 0, 1)),
          end: timeRange.end_date || this.formatDate(today),
        };
      }
      case 'all':
      default: {
        return {
          start: '2020-01-01',
          end: this.formatDate(today),
        };
      }
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 経費集計
   */
  private async getExpenseSummary(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    let query = this.supabase
      .from('expenses')
      .select('amount, department, account_item')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (intent.filters.department) {
      query = query.eq('department', intent.filters.department);
    }
    if (intent.filters.account_item) {
      query = query.eq('account_item', intent.filters.account_item);
    }

    const { data, error } = await query;

    if (error) throw error;

    const total = data?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    // 勘定科目別に集計
    const byCategory = this.groupBy(data || [], 'account_item');

    return {
      type: 'summary',
      title: '経費サマリー',
      columns: [
        { key: 'category', label: '勘定科目' },
        { key: 'amount', label: '金額' },
      ],
      data: Object.entries(byCategory)
        .map(([category, amount]) => ({ category: category || '未分類', amount }))
        .sort((a, b) => b.amount - a.amount),
      total,
      metadata: {
        query_type: 'expense_summary',
        date_range: { start, end },
        filters: intent.filters,
      },
    };
  }

  /**
   * 勘定科目別経費
   */
  private async getExpenseByCategory(intent: QueryIntent): Promise<QueryResult> {
    return this.getExpenseSummary(intent);  // 同じ処理
  }

  /**
   * 部門別経費
   */
  private async getExpenseByDepartment(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    const { data, error } = await this.supabase
      .from('expenses')
      .select('amount, department')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (error) throw error;

    const byDepartment = this.groupBy(data || [], 'department');
    const total = Object.values(byDepartment).reduce((sum, val) => sum + val, 0);

    const departmentLabels: Record<string, string> = {
      PHOTO: '写真',
      VIDEO: '動画',
      WEB: 'Web',
      COMMON: '共通',
    };

    return {
      type: 'table',
      title: '部門別経費',
      columns: [
        { key: 'department', label: '部門' },
        { key: 'amount', label: '金額' },
      ],
      data: Object.entries(byDepartment)
        .map(([dept, amount]) => ({
          department: departmentLabels[dept] || dept,
          amount,
        }))
        .sort((a, b) => b.amount - a.amount),
      total,
      metadata: {
        query_type: 'expense_by_department',
        date_range: { start, end },
      },
    };
  }

  /**
   * 経費明細
   */
  private async getExpenseDetail(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    let query = this.supabase
      .from('expenses')
      .select('transaction_date, amount, account_item, description, department')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .limit(intent.aggregation.limit || 20);

    if (intent.filters.department) {
      query = query.eq('department', intent.filters.department);
    }
    if (intent.filters.account_item) {
      query = query.eq('account_item', intent.filters.account_item);
    }

    const { data, error } = await query;
    if (error) throw error;

    const total = data?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    return {
      type: 'table',
      title: '経費明細',
      columns: [
        { key: 'transaction_date', label: '日付' },
        { key: 'account_item', label: '勘定科目' },
        { key: 'description', label: '摘要' },
        { key: 'amount', label: '金額' },
      ],
      data: data || [],
      total,
      metadata: {
        query_type: 'expense_detail',
        date_range: { start, end },
      },
    };
  }

  /**
   * 売上集計
   */
  private async getSalesSummary(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    let query = this.supabase
      .from('sales')
      .select('amount, net_amount, fee_amount, department, channel, status')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (intent.filters.department) {
      query = query.eq('department', intent.filters.department);
    }
    if (intent.filters.channel) {
      query = query.eq('channel', intent.filters.channel);
    }

    const { data, error } = await query;
    if (error) throw error;

    const totalAmount = data?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;
    const totalNet = data?.reduce((sum, row) => sum + (row.net_amount || row.amount || 0), 0) || 0;
    const totalFees = data?.reduce((sum, row) => sum + (row.fee_amount || 0), 0) || 0;
    const paidCount = data?.filter(row => row.status === 'PAID').length || 0;
    const unpaidCount = data?.filter(row => row.status === 'UNPAID').length || 0;

    return {
      type: 'summary',
      title: '売上サマリー',
      columns: [
        { key: 'label', label: '項目' },
        { key: 'value', label: '金額/件数' },
      ],
      data: [
        { label: '売上合計', value: totalAmount },
        { label: '手数料合計', value: totalFees },
        { label: '手取り合計', value: totalNet },
        { label: '入金済み件数', value: `${paidCount}件` },
        { label: '未入金件数', value: `${unpaidCount}件` },
      ],
      total: totalAmount,
      metadata: {
        query_type: 'sales_summary',
        date_range: { start, end },
      },
    };
  }

  /**
   * チャネル別売上
   */
  private async getSalesByChannel(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    const { data, error } = await this.supabase
      .from('sales')
      .select('amount, channel')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (error) throw error;

    const byChannel = this.groupBy(data || [], 'channel');
    const total = Object.values(byChannel).reduce((sum, val) => sum + val, 0);

    const channelLabels: Record<string, string> = {
      DIRECT: '直接',
      REFERRAL: '紹介',
      SNS: 'SNS',
      WEBSITE: 'ウェブサイト',
      PLATFORM_KURASHI: 'くらしのマーケット',
      PLATFORM_TOTTA: 'Totta',
      REPEAT: 'リピート',
      OTHER: 'その他',
    };

    return {
      type: 'table',
      title: 'チャネル別売上',
      columns: [
        { key: 'channel', label: 'チャネル' },
        { key: 'amount', label: '金額' },
      ],
      data: Object.entries(byChannel)
        .map(([ch, amount]) => ({
          channel: channelLabels[ch] || ch || '不明',
          amount,
        }))
        .sort((a, b) => b.amount - a.amount),
      total,
      metadata: {
        query_type: 'sales_by_channel',
        date_range: { start, end },
      },
    };
  }

  /**
   * 部門別売上
   */
  private async getSalesByDepartment(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    const { data, error } = await this.supabase
      .from('sales')
      .select('amount, department')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (error) throw error;

    const byDepartment = this.groupBy(data || [], 'department');
    const total = Object.values(byDepartment).reduce((sum, val) => sum + val, 0);

    const departmentLabels: Record<string, string> = {
      PHOTO: '写真',
      VIDEO: '動画',
      WEB: 'Web',
      COMMON: '共通',
    };

    return {
      type: 'table',
      title: '部門別売上',
      columns: [
        { key: 'department', label: '部門' },
        { key: 'amount', label: '金額' },
      ],
      data: Object.entries(byDepartment)
        .map(([dept, amount]) => ({
          department: departmentLabels[dept] || dept,
          amount,
        }))
        .sort((a, b) => b.amount - a.amount),
      total,
      metadata: {
        query_type: 'sales_by_department',
        date_range: { start, end },
      },
    };
  }

  /**
   * 未入金売上
   */
  private async getUnpaidSales(intent: QueryIntent): Promise<QueryResult> {
    const { data, error } = await this.supabase
      .from('sales')
      .select('transaction_date, amount, client_name, channel')
      .eq('status', 'UNPAID')
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    const total = data?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    const channelLabels: Record<string, string> = {
      DIRECT: '直接',
      REFERRAL: '紹介',
      SNS: 'SNS',
      WEBSITE: 'ウェブサイト',
      PLATFORM_KURASHI: 'くらしのマーケット',
      PLATFORM_TOTTA: 'Totta',
      REPEAT: 'リピート',
      OTHER: 'その他',
    };

    return {
      type: 'table',
      title: '未入金売上一覧',
      columns: [
        { key: 'transaction_date', label: '日付' },
        { key: 'client_name', label: '取引先' },
        { key: 'channel', label: 'チャネル' },
        { key: 'amount', label: '金額' },
      ],
      data: (data || []).map(row => ({
        ...row,
        channel: channelLabels[row.channel] || row.channel || '不明',
      })),
      total,
      metadata: {
        query_type: 'sales_unpaid',
      },
    };
  }

  /**
   * 売上明細
   */
  private async getSalesDetail(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    let query = this.supabase
      .from('sales')
      .select('transaction_date, amount, client_name, channel, status')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .limit(intent.aggregation.limit || 20);

    if (intent.filters.department) {
      query = query.eq('department', intent.filters.department);
    }

    const { data, error } = await query;
    if (error) throw error;

    const total = data?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    return {
      type: 'table',
      title: '売上明細',
      columns: [
        { key: 'transaction_date', label: '日付' },
        { key: 'client_name', label: '取引先' },
        { key: 'amount', label: '金額' },
        { key: 'status', label: 'ステータス' },
      ],
      data: (data || []).map(row => ({
        ...row,
        status: row.status === 'PAID' ? '入金済' : '未入金',
      })),
      total,
      metadata: {
        query_type: 'sales_detail',
        date_range: { start, end },
      },
    };
  }

  /**
   * 口座残高
   */
  private async getBankBalance(intent: QueryIntent): Promise<QueryResult> {
    // 全口座を取得
    const { data: accounts, error: accError } = await this.supabase
      .from('bank_accounts')
      .select('id, name, bank_type, initial_balance')
      .eq('is_active', true);

    if (accError) throw accError;

    const results = [];
    let totalBalance = 0;

    for (const account of accounts || []) {
      // 各口座の最新残高を取得
      const { data: latestTx } = await this.supabase
        .from('bank_transactions')
        .select('balance')
        .eq('bank_account_id', account.id)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .single();

      const balance = latestTx?.balance ?? account.initial_balance ?? 0;
      totalBalance += balance;

      results.push({
        name: account.name,
        balance,
      });
    }

    return {
      type: 'table',
      title: '口座残高',
      columns: [
        { key: 'name', label: '口座名' },
        { key: 'balance', label: '残高' },
      ],
      data: results,
      total: totalBalance,
      metadata: {
        query_type: 'bank_balance',
      },
    };
  }

  /**
   * 損益サマリー
   */
  private async getProfitLoss(intent: QueryIntent): Promise<QueryResult> {
    const { start, end } = this.getDateRange(intent.time_range);

    // 売上合計
    const { data: salesData } = await this.supabase
      .from('sales')
      .select('amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    const totalSales = salesData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    // 経費合計
    const { data: expenseData } = await this.supabase
      .from('expenses')
      .select('amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    const totalExpenses = expenseData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    const profit = totalSales - totalExpenses;

    return {
      type: 'summary',
      title: '損益サマリー',
      columns: [
        { key: 'label', label: '項目' },
        { key: 'value', label: '金額' },
      ],
      data: [
        { label: '売上合計', value: totalSales },
        { label: '経費合計', value: totalExpenses },
        { label: '利益', value: profit },
      ],
      total: profit,
      metadata: {
        query_type: 'profit_loss',
        date_range: { start, end },
      },
    };
  }

  /**
   * 一般的なサマリー（デフォルト）
   */
  private async getGeneralSummary(intent: QueryIntent): Promise<QueryResult> {
    const fiscalYear = getCurrentFiscalYear();
    const { start, end } = getFiscalYearRange(fiscalYear);

    // 売上
    const { data: salesData } = await this.supabase
      .from('sales')
      .select('amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    const totalSales = salesData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    // 経費
    const { data: expenseData } = await this.supabase
      .from('expenses')
      .select('amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    const totalExpenses = expenseData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    // 未入金
    const { data: unpaidData } = await this.supabase
      .from('sales')
      .select('amount')
      .eq('status', 'UNPAID');

    const totalUnpaid = unpaidData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;

    return {
      type: 'summary',
      title: `${fiscalYear}年度 概要`,
      columns: [
        { key: 'label', label: '項目' },
        { key: 'value', label: '金額' },
      ],
      data: [
        { label: '売上合計', value: totalSales },
        { label: '経費合計', value: totalExpenses },
        { label: '利益', value: totalSales - totalExpenses },
        { label: '未入金売上', value: totalUnpaid },
      ],
      total: totalSales - totalExpenses,  // 利益をtotalとして設定
      metadata: {
        query_type: 'general',
        date_range: { start, end },
      },
    };
  }

  /**
   * グループ化ヘルパー
   */
  private groupBy(
    data: Record<string, unknown>[],
    key: string
  ): Record<string, number> {
    return data.reduce<Record<string, number>>((acc, row) => {
      const groupKey = String(row[key] || '未分類');
      const amount = Number(row['amount']) || 0;
      acc[groupKey] = (acc[groupKey] || 0) + amount;
      return acc;
    }, {});
  }
}
