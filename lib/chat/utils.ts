import { getFiscalYearRange, getCurrentFiscalYear } from '@/lib/fiscalYear';
import type { TimeRange } from './types';

/**
 * Date を YYYY-MM-DD 形式にフォーマット
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 日付文字列を日本語表記に変換
 */
export function formatDateJapanese(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 月名を取得（例: "2024年11月"）
 */
export function getMonthLabel(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/**
 * TimeRange から具体的な日付範囲を計算
 */
export function calculateDateRange(timeRange: TimeRange): { start: string; end: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11

    switch (timeRange.type) {
        case 'current_month': {
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0); // 月末
            return {
                start: formatDate(start),
                end: formatDate(end),
            };
        }

        case 'last_month': {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0); // 前月末
            return {
                start: formatDate(start),
                end: formatDate(end),
            };
        }

        case 'current_fiscal_year': {
            const fiscalYear = getCurrentFiscalYear();
            return getFiscalYearRange(fiscalYear);
        }

        case 'custom': {
            // カスタム範囲: start_date と end_date を使用
            return {
                start: timeRange.start_date || formatDate(new Date(year, 0, 1)),
                end: timeRange.end_date || formatDate(today),
            };
        }

        case 'all':
        default: {
            // 全期間: 非常に広い範囲を設定
            return {
                start: '2020-01-01',
                end: formatDate(today),
            };
        }
    }
}

/**
 * 前月の日付範囲を取得
 */
export function getPreviousMonthRange(baseDate: Date = new Date()): { start: string; end: string } {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    return {
        start: formatDate(start),
        end: formatDate(end),
    };
}

/**
 * 前年同月の日付範囲を取得
 */
export function getPreviousYearSameMonthRange(baseDate: Date = new Date()): { start: string; end: string } {
    const year = baseDate.getFullYear() - 1;
    const month = baseDate.getMonth();

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    return {
        start: formatDate(start),
        end: formatDate(end),
    };
}

/**
 * 期間のラベルを生成
 */
export function getDateRangeLabel(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // 同じ月の場合
    if (
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth()
    ) {
        return `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
    }

    // 会計年度の場合（11月〜10月）
    if (
        startDate.getMonth() === 10 && // 11月
        endDate.getMonth() === 9 // 10月
    ) {
        return `${endDate.getFullYear()}年度`;
    }

    // その他
    return `${formatDateJapanese(start)} 〜 ${formatDateJapanese(end)}`;
}

/**
 * 金額を日本円形式でフォーマット（3桁区切り）
 * 例: 1234567 → "¥1,234,567"
 */
export function formatCurrency(amount: number): string {
    return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * 金額を短縮形式でフォーマット
 * 例: 1234567 → "約123万円"
 */
export function formatCurrencyShort(amount: number): string {
    if (amount >= 100000000) {
        return `約${Math.round(amount / 100000000)}億円`;
    }
    if (amount >= 10000) {
        return `約${Math.round(amount / 10000)}万円`;
    }
    return formatCurrency(amount);
}

/**
 * パーセンテージをフォーマット
 * 例: 0.156 → "+15.6%"
 */
export function formatPercentage(value: number, showSign = true): string {
    const percentage = (value * 100).toFixed(1);
    if (showSign && value > 0) {
        return `+${percentage}%`;
    }
    return `${percentage}%`;
}

/**
 * 数値の増減を表す矢印を取得
 */
export function getTrendIcon(current: number, previous: number): string {
    if (current > previous) return '↑';
    if (current < previous) return '↓';
    return '→';
}
