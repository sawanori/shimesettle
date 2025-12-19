import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getActionClassificationPrompt(): string {
  const currentDate = new Date().toISOString().split('T')[0];

  return `あなたは経費・売上管理システムのアシスタントです。
ユーザーの入力を分析し、以下のいずれかのアクションを判定してください。

## アクションタイプ
1. register_expense: 経費を登録したい場合
2. register_sale: 売上を登録したい場合
3. query: データを照会・質問したい場合

## 判定ルール
- 「登録」「追加」「記録」「入れて」「計上」などの言葉 → register系
- 「経費」「出費」「支出」「〇〇代」「〇〇費」+ 登録意図 → register_expense
- 「売上」「収入」「入金」+ 登録意図 → register_sale
- 「いくら」「教えて」「見せて」「一覧」「合計」などの質問 → query

## 出力形式（必ずこのJSON形式のみで出力）
{
  "action_type": "register_expense | register_sale | query",
  "expense_data": {
    "transaction_date": "${currentDate}",
    "amount": 金額（数値）,
    "account_item": "勘定科目名",
    "department": "COMMON",
    "description": "説明（任意）"
  },
  "sale_data": {
    "transaction_date": "${currentDate}",
    "amount": 金額（数値）,
    "client_name": "取引先名",
    "department": "COMMON",
    "channel": "DIRECT",
    "status": "PAID",
    "description": "説明（任意）"
  },
  "confidence": 0.0〜1.0の確信度
}

## 勘定科目の推測ルール
- 「電車」「タクシー」「交通」→ 旅費交通費
- 「ランチ」「飲み会」「会食」→ 接待交際費
- 「文房具」「備品」→ 消耗品費
- 「電話」「ネット」「通信」→ 通信費
- 「外注」「委託」→ 外注費
- 「広告」「宣伝」→ 広告宣伝費
- 「家賃」「オフィス」→ 地代家賃
- 不明な場合 → 雑費

## 部門の推測ルール
- 「写真」「撮影」「フォト」→ PHOTO
- 「動画」「映像」「ビデオ」→ VIDEO
- 「Web」「ウェブ」「サイト」→ WEB
- 特に指定なし → COMMON

## 注意事項
- action_type が "query" の場合、expense_data と sale_data は null にする
- 金額が明示されていない場合は confidence を低く（0.3以下）設定
- JSONのみを出力し、説明文は含めない`;
}

async function testAPI() {
  const testMessage = '電車代1500円を登録して';
  const prompt = getActionClassificationPrompt() + '\n\n重要: 必ずJSON形式のみで回答してください。説明文は不要です。';

  console.log('=== Test with actual prompt ===');
  console.log('Message:', testMessage);
  console.log('Prompt length:', prompt.length);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: testMessage },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 500,
    });
    console.log('\nResponse:', response.choices[0].message.content);
    console.log('Finish reason:', response.choices[0].finish_reason);
    console.log('Tokens used:', response.usage?.total_tokens);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
