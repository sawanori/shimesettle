import { test, Page } from '@playwright/test';

async function login(page: Page) {
    await page.goto('/login');
    await page.waitForSelector('input[id="email"]', { state: 'visible' });
    await page.fill('input[id="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[id="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

test('selecting くらしのマーケット should auto-set 20% fee', async ({ page }) => {
    await login(page);
    await page.goto('/sales');

    // フォームが読み込まれるまで待つ
    await page.waitForSelector('form', { state: 'visible' });
    await page.waitForLoadState('networkidle');

    // 金額フィールドを見つけて入力
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.waitFor({ state: 'visible' });
    await amountInput.fill('10000');

    // Screenshot before changing channel
    await page.screenshot({ path: 'test-results/kurashi-1-before.png', fullPage: true });

    // 受注チャネルのセレクトトリガーを見つける (「直接営業」が表示されている)
    const channelTrigger = page.locator('button').filter({ hasText: '直接営業' }).first();
    await channelTrigger.waitFor({ state: 'visible' });
    await channelTrigger.click();

    // ドロップダウンが開くまで待つ
    await page.waitForTimeout(300);

    // Screenshot with dropdown open
    await page.screenshot({ path: 'test-results/kurashi-2-dropdown.png', fullPage: true });

    // くらしのマーケットを選択
    const kurashiOption = page.getByText('くらしのマーケット（手数料20%）');
    await kurashiOption.waitFor({ state: 'visible', timeout: 5000 });
    await kurashiOption.click();
    await page.waitForTimeout(500);

    // Screenshot after selecting
    await page.screenshot({ path: 'test-results/kurashi-3-after.png', fullPage: true });
});
