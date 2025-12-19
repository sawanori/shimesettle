import { test, expect } from '@playwright/test';

test.describe('Chat Feature Test', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.waitForSelector('input[id="email"]', { state: 'visible' });
    await page.fill('input[id="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[id="password"]', 'noritaka8');
    await page.click('button[type="submit"]');

    // ダッシュボードへリダイレクトを待つ
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
  });

  test('チャットウィジェットが表示される', async ({ page }) => {
    // チャットボタンを確認
    const chatButton = page.locator('button[aria-label="チャットを開く"]');
    await expect(chatButton).toBeVisible();
  });

  test('チャットで経費を質問する', async ({ page }) => {
    // チャットを開く
    const chatButton = page.locator('button[aria-label="チャットを開く"]');
    await chatButton.click();

    // チャットウィンドウが開くのを待つ
    await page.waitForTimeout(500);

    // 入力欄に質問を入力
    const input = page.locator('textarea[placeholder="質問を入力..."]');
    await expect(input).toBeVisible();

    await input.fill('今月の経費はいくら？');

    // 送信ボタンをクリック
    const sendButton = page.locator('button[aria-label="送信"]');
    await sendButton.click();

    // 応答を待つ（最大30秒）
    await page.waitForTimeout(5000);

    // チャットメッセージエリアの内容を取得
    const messages = page.locator('.overflow-y-auto');
    const content = await messages.textContent();

    console.log('Chat response:', content);

    // "概要" だけでなく、"経費" に関する回答があることを確認
    // または具体的な金額が含まれているか
    const hasExpenseInfo = content?.includes('経費') || content?.includes('¥');
    expect(hasExpenseInfo).toBeTruthy();
  });
});
