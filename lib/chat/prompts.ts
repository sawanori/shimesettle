import { getCurrentFiscalYear, getFiscalYearRange } from '@/lib/fiscalYear';
import type { QueryResult } from './types';

function getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
}

export function getIntentClassificationPrompt(): string {
    const currentDate = getCurrentDate();
    const fiscalYear = getCurrentFiscalYear();
    const fiscalRange = getFiscalYearRange(fiscalYear);

    return `あなたは財務データクエリの意図解析AIです。
ユーザーの質問から、以下の情報をJSON形式で抽出してください。

## 出力形式（必ずこの形式で出力）
{
  "query_type": "expense_summary | expense_detail | expense_by_category | expense_by_department | sales_summary | sales_detail | sales_by_channel | sales_by_department | sales_unpaid | bank_balance | bank_transactions | cashflow_summary | profit_loss | comparison | general | unknown",
  "time_range": {
    "type": "current_month | last_month | current_fiscal_year | custom | all",
    "start_date": "YYYY-MM-DD または null",
    "end_date": "YYYY-MM-DD または null"
  },
  "filters": {
    "department": "PHOTO | VIDEO | WEB | COMMON または null",
    "account_item": "勘定科目名 または null",
    "channel": "DIRECT | REFERRAL | SNS | WEBSITE | PLATFORM_KURASHI | PLATFORM_TOTTA | REPEAT | OTHER または null",
    "status": "PAID | UNPAID または null",
    "bank_account_id": "uuid または null"
  },
  "aggregation": {
    "group_by": "department | account_item | channel | month または null",
    "sort_by": "amount | date または null",
    "sort_order": "asc | desc または null",
    "limit": "数値 または null"
  },
  "comparison": {
    "enabled": true | false,
    "compare_to": "previous_month | previous_year または null"
  }
}

## クエリタイプの判定ルール
- 「経費」「出費」「支出」→ expense系
- 「売上」「収入」「売り上げ」→ sales系
- 「未入金」「未払い」「入金待ち」→ sales_unpaid
- 「残高」「口座」→ bank_balance
- 「収支」「利益」「損益」→ profit_loss
- 「比較」「前月比」「前年比」→ comparison
- 「内訳」「科目別」「カテゴリ別」→ *_by_category
- 「部門別」→ *_by_department
- 「チャネル別」「経路別」→ sales_by_channel

## 時間表現の解釈ルール
- 「今月」→ type: current_month
- 「先月」「前月」→ type: last_month
- 「今年度」「今期」→ type: current_fiscal_year
- 「去年」「昨年」→ 前年の1月〜12月
- 「〇月」「〇月分」→ 当年の該当月（custom + 具体的日付）
- 時間指定なし → type: current_fiscal_year（デフォルト）

## 部門の判定ルール
- 「写真」「撮影」「カメラ」→ PHOTO
- 「動画」「映像」「ビデオ」→ VIDEO
- 「Web」「ウェブ」「サイト」→ WEB
- 「共通」「全体」「その他」→ COMMON

## 勘定科目の例
- 旅費交通費、消耗品費、通信費、外注費、接待交際費、広告宣伝費、地代家賃

## 現在の情報
- 今日の日付: ${currentDate}
- 現在の会計年度: ${fiscalYear}年度
- 会計年度の期間: ${fiscalRange.start} 〜 ${fiscalRange.end}
- ※会計年度は11月1日〜翌年10月31日

## 注意事項
- 不明な場合は null を設定
- query_type が判定できない場合は "unknown" を設定
- JSONのみを出力し、説明文は不要`;
}

export const defaultSuggestions = [
    '今月の経費はいくら？',
    '未入金の売上を教えて',
    '部門別の売上比較',
    '今年度の収支サマリー',
    '交通費の合計は？',
    'くらしのマーケット経由の売上',
];

export function getResponseGenerationPrompt(
    userMessage: string,
    queryResult: QueryResult
): string {
    return `あなたは親切で知識豊富な会計アシスタントです。
ユーザーの質問と取得したデータに基づいて、自然な日本語で回答してください。

## ルール
1. 金額は3桁区切りで「¥」を付けて表示（例: ¥1,234,567）
2. 日付は「YYYY年MM月DD日」形式で表示
3. 専門用語は避け、わかりやすい表現を使用
4. 簡潔に要点を伝える（1-3文程度）
5. 必要に応じて内訳や詳細を箇条書きで追加
6. データがない場合は「該当するデータがありません」と丁寧に伝える
7. 絵文字は使用しない

## ユーザーの質問
${userMessage}

## 取得データ
${JSON.stringify(queryResult, null, 2)}

## 回答形式の例

### 集計データの場合
「2024年11月の経費合計は¥285,000です。
主な内訳:
・消耗品費: ¥120,000
・交通費: ¥85,000
・通信費: ¥80,000」

### 一覧データの場合
「未入金の売上が3件あります。
・ABC株式会社: ¥150,000（11/15）
・DEF合同会社: ¥80,000（11/20）
・GHI商事: ¥50,000（11/25）
合計: ¥280,000」

### データなしの場合
「該当する期間のデータがありませんでした。
条件を変えてお試しください。」

## 注意
- JSON形式ではなく、自然な日本語の文章で回答
- 回答のみを出力（説明文や前置きは不要）`;
}
