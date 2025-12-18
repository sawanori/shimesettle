import { test, expect, Page } from '@playwright/test';

// Login helper
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test.describe('Responsive Design - Mobile', () => {
    test.beforeEach(async ({ page }) => {
        // Set mobile viewport (iPhone 12)
        await page.setViewportSize({ width: 390, height: 844 });
    });

    test('dashboard should be responsive on mobile', async ({ page }) => {
        await login(page);
        await page.goto('/');
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/mobile-dashboard.png', fullPage: true });

        // Check title is visible
        const title = await page.getByText('NonTurn決算申告').isVisible();
        expect(title).toBeTruthy();

        // Check navigation buttons are visible (use link locator for more reliable detection)
        const expenseLink = await page.locator('a[href="/expenses"]').isVisible();
        expect(expenseLink).toBeTruthy();

        const salesLink = await page.locator('a[href="/sales"]').isVisible();
        expect(salesLink).toBeTruthy();
    });

    test('documents page should be responsive on mobile', async ({ page }) => {
        await login(page);
        await page.goto('/documents');
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/mobile-documents.png', fullPage: true });

        // Check title is visible
        const title = await page.getByText('参考書類').isVisible();
        expect(title).toBeTruthy();

        // Check tabs are visible
        const listTab = await page.getByText('書類一覧').isVisible();
        expect(listTab).toBeTruthy();
    });

    test('expenses page should be responsive on mobile', async ({ page }) => {
        await login(page);
        await page.goto('/expenses');
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/mobile-expenses.png', fullPage: true });

        // Check title is visible
        const title = await page.getByText('経費登録').isVisible();
        expect(title).toBeTruthy();
    });
});

test.describe('Responsive Design - Tablet', () => {
    test.beforeEach(async ({ page }) => {
        // Set tablet viewport (iPad)
        await page.setViewportSize({ width: 768, height: 1024 });
    });

    test('dashboard should be responsive on tablet', async ({ page }) => {
        await login(page);
        await page.goto('/');
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/tablet-dashboard.png', fullPage: true });

        // Check title is visible
        const title = await page.getByText('NonTurn決算申告').isVisible();
        expect(title).toBeTruthy();
    });
});
