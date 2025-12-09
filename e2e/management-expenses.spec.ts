import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test('should display expense thumbnails in management console', async ({ page }) => {
    await login(page);
    await page.goto('/management');
    await page.waitForTimeout(2000);

    // Expenses tab should be active by default
    await page.screenshot({ path: 'test-results/management-expenses-thumbnails.png', fullPage: true });

    // Verify expenses tab has thumbnails column
    const receiptHeader = page.locator('th:has-text("領収書")');
    await expect(receiptHeader).toBeVisible();
});
