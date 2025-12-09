/**
 * 会計年度ユーティリティ
 * 11月1日〜翌年10月31日を1会計年度とする
 */

/**
 * 指定された日付の会計年度を取得
 * 例: 2024年11月〜2025年10月 = 2024年度
 */
export function getFiscalYear(date: Date): number {
    const month = date.getMonth() + 1; // 0-indexed -> 1-indexed
    const year = date.getFullYear();

    // 11月以降は当年が会計年度、10月以前は前年が会計年度
    return month >= 11 ? year : year - 1;
}

/**
 * 現在進行中の会計年度を取得
 */
export function getOngoingFiscalYear(): number {
    return getFiscalYear(new Date());
}

/**
 * 決算申告対象の会計年度を取得（直近終了した年度）
 * 決算申告は終了した会計年度に対して行うため、前年度を返す
 */
export function getCurrentFiscalYear(): number {
    return getFiscalYear(new Date()) - 1;
}

/**
 * 会計年度の開始日・終了日を取得
 */
export function getFiscalYearRange(fiscalYear: number): { start: string; end: string } {
    return {
        start: `${fiscalYear}-11-01`,
        end: `${fiscalYear + 1}-10-31`,
    };
}

/**
 * 日付文字列（YYYY-MM-DD）が指定した会計年度に属するかチェック
 */
export function isInFiscalYear(dateString: string, fiscalYear: number): boolean {
    const date = new Date(dateString);
    return getFiscalYear(date) === fiscalYear;
}

/**
 * 会計年度の表示ラベルを生成
 * 例: 2024 -> "2024年度 (2024/11〜2025/10)"
 */
export function getFiscalYearLabel(fiscalYear: number): string {
    return `${fiscalYear}年度 (${fiscalYear}/11〜${fiscalYear + 1}/10)`;
}

/**
 * 選択可能な会計年度のリストを生成（過去5年分 + 現在）
 */
export function getSelectableFiscalYears(): number[] {
    const current = getCurrentFiscalYear();
    const years: number[] = [];
    for (let i = 0; i <= 5; i++) {
        years.push(current - i);
    }
    return years;
}
