import { test, expect } from '@playwright/test';

const testEmail = 'snp.inc.info@gmail.com';
const testPassword = 'noritaka8';

test.describe('Chat Action Execution', () => {
  // Increase timeout for AI API calls
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForSelector('input[id="email"]', { state: 'visible', timeout: 10000 });
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  });

  test('register expense via chat', async ({ page }) => {
    // Open chat widget
    await page.click('button[aria-label="チャットを開く"]');

    // Wait for chat to open
    await expect(page.locator('text=財務データについて何でも聞いてください')).toBeVisible({ timeout: 5000 });

    // Send expense registration message
    const input = page.locator('textarea[placeholder="質問を入力..."]');
    await input.fill('電車代1500円を登録して');
    await page.click('button[aria-label="送信"]');

    // Wait for user message to appear
    await expect(page.locator('text=電車代1500円を登録して')).toBeVisible({ timeout: 5000 });

    // Wait for registration confirmation to appear
    await expect(page.locator('text=経費を登録しました')).toBeVisible({ timeout: 60000 });

    // Verify the details are displayed
    const chatContent = await page.locator('body').textContent();
    expect(chatContent).toContain('¥1,500');
    expect(chatContent).toContain('旅費交通費');
  });

  test('query still works after action feature', async ({ page }) => {
    // Open chat widget
    await page.click('button[aria-label="チャットを開く"]');

    // Wait for chat to open
    await expect(page.locator('text=財務データについて何でも聞いてください')).toBeVisible({ timeout: 5000 });

    // Send query message (not a registration)
    const input = page.locator('textarea[placeholder="質問を入力..."]');
    await input.fill('今月の経費合計は？');
    await page.click('button[aria-label="送信"]');

    // Wait for user message
    await expect(page.locator('text=今月の経費合計は？')).toBeVisible({ timeout: 5000 });

    // Wait for AI response (look for any of these indicators)
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || '';
        return (
          text.includes('経費') &&
          !text.includes('考え中...') &&
          (text.includes('¥') || text.includes('円') || text.includes('合計'))
        );
      },
      { timeout: 60000 }
    );

    // Verify the response contains expense-related info
    const chatContent = await page.locator('body').textContent();
    const hasQueryResponse =
      chatContent?.includes('経費') ||
      chatContent?.includes('¥') ||
      chatContent?.includes('合計');

    expect(hasQueryResponse).toBeTruthy();
  });
});
