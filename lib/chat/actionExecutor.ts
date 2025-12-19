import { SupabaseClient } from '@supabase/supabase-js';
import type { ActionIntent, ActionResult, ExpenseData, SaleData } from './types';

/**
 * アクション実行クラス
 */
export class ActionExecutor {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * アクションを実行
   */
  async execute(actionIntent: ActionIntent): Promise<ActionResult> {
    console.log('[ActionExecutor] Executing action:', actionIntent.action_type);

    switch (actionIntent.action_type) {
      case 'register_expense':
        if (!actionIntent.expense_data) {
          return {
            success: false,
            action_type: 'register_expense',
            message: '経費データが不足しています。金額と内容を指定してください。',
          };
        }
        return this.registerExpense(actionIntent.expense_data);

      case 'register_sale':
        if (!actionIntent.sale_data) {
          return {
            success: false,
            action_type: 'register_sale',
            message: '売上データが不足しています。金額と取引先を指定してください。',
          };
        }
        return this.registerSale(actionIntent.sale_data);

      case 'query':
      default:
        return {
          success: false,
          action_type: 'query',
          message: 'クエリアクションは別の処理で実行されます。',
        };
    }
  }

  /**
   * 経費を登録
   */
  private async registerExpense(data: ExpenseData): Promise<ActionResult> {
    try {
      console.log('[ActionExecutor] Registering expense:', data);

      const { data: inserted, error } = await this.supabase
        .from('expenses')
        .insert({
          transaction_date: data.transaction_date,
          amount: data.amount,
          account_item: data.account_item,
          department: data.department,
          description: data.description || null,
          user_id: this.userId,
          ai_check_status: 'UNCHECKED',
        })
        .select()
        .single();

      if (error) {
        console.error('[ActionExecutor] Insert error:', error);
        return {
          success: false,
          action_type: 'register_expense',
          message: `経費の登録に失敗しました: ${error.message}`,
        };
      }

      console.log('[ActionExecutor] Expense registered:', inserted);

      return {
        success: true,
        action_type: 'register_expense',
        message: this.formatExpenseSuccessMessage(data),
        data: inserted,
      };
    } catch (error) {
      console.error('[ActionExecutor] Error:', error);
      return {
        success: false,
        action_type: 'register_expense',
        message: '経費の登録中にエラーが発生しました。',
      };
    }
  }

  /**
   * 売上を登録
   */
  private async registerSale(data: SaleData): Promise<ActionResult> {
    try {
      console.log('[ActionExecutor] Registering sale:', data);

      // 手数料計算（くらしのマーケットの場合）
      let feeAmount: number | null = null;
      let feeRate: number | null = null;
      let netAmount = data.amount;

      if (data.channel === 'PLATFORM_KURASHI') {
        feeRate = 20;
        feeAmount = Math.round(data.amount * 0.2);
        netAmount = data.amount - feeAmount;
      }

      const { data: inserted, error } = await this.supabase
        .from('sales')
        .insert({
          transaction_date: data.transaction_date,
          amount: data.amount,
          client_name: data.client_name,
          department: data.department,
          channel: data.channel,
          status: data.status,
          fee_amount: feeAmount,
          fee_rate: feeRate,
          net_amount: netAmount,
          user_id: this.userId,
        })
        .select()
        .single();

      if (error) {
        console.error('[ActionExecutor] Insert error:', error);
        return {
          success: false,
          action_type: 'register_sale',
          message: `売上の登録に失敗しました: ${error.message}`,
        };
      }

      // くらしのマーケットの場合は手数料も経費として登録
      if (feeAmount && feeAmount > 0) {
        await this.supabase.from('expenses').insert({
          transaction_date: data.transaction_date,
          amount: feeAmount,
          department: data.department,
          account_item: '支払手数料',
          description: `くらしのマーケット手数料 - ${data.client_name}`,
          user_id: this.userId,
          ai_check_status: 'UNCHECKED',
        });
      }

      console.log('[ActionExecutor] Sale registered:', inserted);

      return {
        success: true,
        action_type: 'register_sale',
        message: this.formatSaleSuccessMessage(data, feeAmount),
        data: inserted,
      };
    } catch (error) {
      console.error('[ActionExecutor] Error:', error);
      return {
        success: false,
        action_type: 'register_sale',
        message: '売上の登録中にエラーが発生しました。',
      };
    }
  }

  /**
   * 経費登録成功メッセージを生成
   */
  private formatExpenseSuccessMessage(data: ExpenseData): string {
    const formattedAmount = `¥${data.amount.toLocaleString('ja-JP')}`;
    const formattedDate = this.formatDate(data.transaction_date);
    const departmentLabel = this.getDepartmentLabel(data.department);

    let message = `経費を登録しました\n\n`;
    message += `・日付: ${formattedDate}\n`;
    message += `・金額: ${formattedAmount}\n`;
    message += `・勘定科目: ${data.account_item}\n`;
    message += `・部門: ${departmentLabel}`;

    if (data.description) {
      message += `\n・摘要: ${data.description}`;
    }

    return message;
  }

  /**
   * 売上登録成功メッセージを生成
   */
  private formatSaleSuccessMessage(data: SaleData, feeAmount: number | null): string {
    const formattedAmount = `¥${data.amount.toLocaleString('ja-JP')}`;
    const formattedDate = this.formatDate(data.transaction_date);
    const departmentLabel = this.getDepartmentLabel(data.department);
    const channelLabel = this.getChannelLabel(data.channel);
    const statusLabel = data.status === 'PAID' ? '入金済み' : '未入金';

    let message = `売上を登録しました\n\n`;
    message += `・日付: ${formattedDate}\n`;
    message += `・金額: ${formattedAmount}\n`;
    message += `・取引先: ${data.client_name}\n`;
    message += `・チャネル: ${channelLabel}\n`;
    message += `・部門: ${departmentLabel}\n`;
    message += `・ステータス: ${statusLabel}`;

    if (feeAmount && feeAmount > 0) {
      const formattedFee = `¥${feeAmount.toLocaleString('ja-JP')}`;
      const netAmount = data.amount - feeAmount;
      const formattedNet = `¥${netAmount.toLocaleString('ja-JP')}`;
      message += `\n\n※手数料 ${formattedFee} を経費に自動登録しました`;
      message += `\n　手取り: ${formattedNet}`;
    }

    return message;
  }

  /**
   * 日付をフォーマット
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * 部門ラベルを取得
   */
  private getDepartmentLabel(department: string): string {
    const labels: Record<string, string> = {
      PHOTO: '写真',
      VIDEO: '動画',
      WEB: 'Web',
      COMMON: '共通',
    };
    return labels[department] || department;
  }

  /**
   * チャネルラベルを取得
   */
  private getChannelLabel(channel: string): string {
    const labels: Record<string, string> = {
      DIRECT: '直接営業',
      REFERRAL: '紹介',
      SNS: 'SNS',
      WEBSITE: 'ウェブサイト',
      PLATFORM_KURASHI: 'くらしのマーケット',
      PLATFORM_TOTTA: 'Totta',
      REPEAT: 'リピート',
      OTHER: 'その他',
    };
    return labels[channel] || channel;
  }
}
