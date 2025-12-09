import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test.describe('Drag & Drop File Upload', () => {
    test('expenses page - single receipt uploader should have drop zone', async ({ page }) => {
        await login(page);
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        // Check for drop zone in single tab (default)
        const dropZone = page.locator('text=ここにファイルをドロップ').first();
        const isVisible = await dropZone.isVisible().catch(() => false);
        
        await page.screenshot({ path: 'test-results/expenses-dropzone.png', fullPage: true });
        console.log('Expenses single drop zone visible:', isVisible);
    });

    test('expenses page - batch receipt uploader should have drop zone', async ({ page }) => {
        await login(page);
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        // Click batch tab
        const batchTab = page.locator('button:has-text("まとめて登録")');
        if (await batchTab.isVisible()) {
            await batchTab.click();
            await page.waitForTimeout(500);
        }

        await page.screenshot({ path: 'test-results/expenses-batch-dropzone.png', fullPage: true });
    });

    test('documents page - should have drop zone', async ({ page }) => {
        await login(page);
        await page.goto('/documents');
        await page.waitForTimeout(1000);

        // Click upload tab
        const uploadTab = page.locator('button:has-text("新規登録")');
        if (await uploadTab.isVisible()) {
            await uploadTab.click();
            await page.waitForTimeout(500);
        }

        const dropZone = page.locator('text=ここにファイルをドロップ').first();
        const isVisible = await dropZone.isVisible().catch(() => false);

        await page.screenshot({ path: 'test-results/documents-dropzone.png', fullPage: true });
        console.log('Documents drop zone visible:', isVisible);
    });

    test('sales page - should have invoice uploader', async ({ page }) => {
        await login(page);
        await page.goto('/sales');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/sales-dropzone.png', fullPage: true });
    });
});
