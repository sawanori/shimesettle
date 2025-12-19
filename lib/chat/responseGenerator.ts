import { OpenAI } from 'openai';
import type { QueryResult, QueryIntent } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 金額を日本円形式でフォーマット
 */
function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * 回答生成用プロンプトを生成
 */
function getResponseGenerationPrompt(
  userMessage: string,
  queryResult: QueryResult,
  intent: QueryIntent
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
8. 金額の大きさに応じたコメントを追加（任意）

## ユーザーの質問
${userMessage}

## クエリタイプ
${intent.query_type}

## 取得データ
タイトル: ${queryResult.title || 'なし'}
データ件数: ${queryResult.data.length}件
合計: ${queryResult.total !== undefined ? formatCurrency(queryResult.total) : 'なし'}

データ内容:
${JSON.stringify(queryResult.data.slice(0, 10), null, 2)}

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
- 回答のみを出力（説明文や前置きは不要）
- データが多い場合は上位5件程度に絞って表示`;
}

/**
 * データなしの場合のフォールバック回答
 */
function getNoDataResponse(intent: QueryIntent): string {
  const typeMessages: Record<string, string> = {
    expense_summary: '指定期間の経費データがありません。',
    sales_summary: '指定期間の売上データがありません。',
    sales_unpaid: '現在、未入金の売上はありません。',
    bank_balance: '登録されている銀行口座がありません。',
    profit_loss: '指定期間のデータがありません。',
  };

  return typeMessages[intent.query_type] || '該当するデータがありませんでした。別の条件でお試しください。';
}

/**
 * シンプルな回答を生成（AIを使わない）
 */
function generateSimpleResponse(
  queryResult: QueryResult,
  intent: QueryIntent
): string {
  if (queryResult.data.length === 0) {
    return getNoDataResponse(intent);
  }

  const title = queryResult.title || '';
  const total = queryResult.total;

  // 集計タイプの場合
  if (queryResult.type === 'summary' && total !== undefined) {
    let response = `${title}:\n合計: ${formatCurrency(total)}\n`;

    if (queryResult.data.length > 0) {
      response += '\n内訳:\n';
      queryResult.data.slice(0, 5).forEach((row) => {
        const label = row.category || row.label || row.department || row.channel || '';
        const value = row.amount || row.value || 0;
        if (typeof value === 'number') {
          response += `・${label}: ${formatCurrency(value)}\n`;
        } else {
          response += `・${label}: ${value}\n`;
        }
      });
    }

    return response.trim();
  }

  // テーブルタイプの場合
  if (queryResult.type === 'table') {
    let response = `${title}: ${queryResult.data.length}件\n`;

    if (total !== undefined) {
      response += `合計: ${formatCurrency(total)}\n`;
    }

    response += '\n';
    queryResult.data.slice(0, 5).forEach((row) => {
      const parts: string[] = [];
      if (row.client_name) parts.push(row.client_name);
      if (row.transaction_date) parts.push(row.transaction_date);
      if (row.account_item) parts.push(row.account_item);
      if (row.description) parts.push(row.description);
      if (row.amount) parts.push(formatCurrency(row.amount));
      response += `・${parts.join(' / ')}\n`;
    });

    if (queryResult.data.length > 5) {
      response += `\n...他${queryResult.data.length - 5}件`;
    }

    return response.trim();
  }

  return `${title}\nデータ: ${queryResult.data.length}件`;
}

/**
 * AIを使って回答を生成
 */
export async function generateResponse(
  userMessage: string,
  queryResult: QueryResult,
  intent: QueryIntent
): Promise<{ response: string; tokensUsed: number }> {
  // データがない場合はシンプルな回答
  if (queryResult.data.length === 0) {
    return {
      response: getNoDataResponse(intent),
      tokensUsed: 0,
    };
  }

  // シンプルなクエリの場合はAIを使わない
  const simpleTypes = ['expense_by_department', 'sales_by_department', 'sales_by_channel'];
  if (simpleTypes.includes(intent.query_type) && queryResult.data.length <= 5) {
    return {
      response: generateSimpleResponse(queryResult, intent),
      tokensUsed: 0,
    };
  }

  try {
    const prompt = getResponseGenerationPrompt(userMessage, queryResult, intent);

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      max_completion_tokens: 2000,  // GPT-5-miniは推論トークンを使用するため増加
    });

    const content = response.choices[0].message.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!content) {
      return {
        response: generateSimpleResponse(queryResult, intent),
        tokensUsed,
      };
    }

    return {
      response: content,
      tokensUsed,
    };

  } catch (error) {
    console.error('Response generation error:', error);
    // フォールバック: シンプルな回答を返す
    return {
      response: generateSimpleResponse(queryResult, intent),
      tokensUsed: 0,
    };
  }
}
