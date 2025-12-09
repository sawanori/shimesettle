import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test('expenses page - batch upload tab', async ({ page }) => {
    await login(page);
    await page.goto('/expenses');
    await page.waitForTimeout(1000);

    // Click batch tab (一括登録)
    await page.click('button:has-text("一括登録")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/expenses-batch-tab.png', fullPage: true });
});
