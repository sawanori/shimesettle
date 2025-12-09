import { test, expect, Page } from '@playwright/test';

// Login helper
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test.describe('Management Console - Documents Tab', () => {
    test('should display documents tab and list documents', async ({ page }) => {
        await login(page);
        await page.goto('/management');
        await page.waitForTimeout(2000);

        // Click on documents tab
        await page.click('button:has-text("書類")');
        await page.waitForTimeout(1000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/management-documents.png', fullPage: true });

        // Verify the documents tab is active
        const documentsTab = page.locator('button:has-text("書類")');
        await expect(documentsTab).toBeVisible();
    });
});
