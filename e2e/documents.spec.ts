import { test, expect, Page } from '@playwright/test';

// Login helper
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test.describe('Documents Page', () => {
    test('should display documents page with thumbnails', async ({ page }) => {
        await login(page);

        // Navigate to documents page
        await page.goto('/documents');
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/documents-page.png', fullPage: true });

        // Check title
        const title = await page.getByText('参考書類').isVisible();
        console.log('Title visible:', title);
        expect(title).toBeTruthy();

        // Check tabs
        const listTab = await page.getByText('書類一覧').isVisible();
        console.log('List tab visible:', listTab);
        expect(listTab).toBeTruthy();

        // Check for document cards
        const cardCount = await page.locator('.grid > div').count();
        console.log('Document cards count:', cardCount);

        // Check for image elements in the grid
        const imageCount = await page.locator('.grid img').count();
        console.log('Image thumbnails:', imageCount);

        // Wait longer for PDF to load
        await page.waitForTimeout(5000);

        // Take another screenshot after waiting
        await page.screenshot({ path: 'test-results/documents-page-loaded.png', fullPage: true });
    });
});
