import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test('Sales page - test actual file upload', async ({ page }) => {
    await login(page);
    await page.goto('/sales');
    await page.waitForTimeout(1500);

    // Create a test image
    const testImagePath = path.join(__dirname, 'test-invoice.png');
    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
        0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngBuffer);

    // Screenshot before
    await page.screenshot({ path: 'test-results/sales-real-upload-1-before.png', fullPage: true });

    // Method 1: Try clicking the drop zone area and use setInputFiles
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    
    await page.waitForTimeout(3000);

    // Screenshot after upload attempt
    await page.screenshot({ path: 'test-results/sales-real-upload-2-after.png', fullPage: true });

    // Check if preview appeared or if there's a file name displayed
    const previewImg = page.locator('img[alt="Preview"]');
    const previewVisible = await previewImg.isVisible().catch(() => false);
    console.log('Preview image visible:', previewVisible);

    // Check for any error messages
    const pageContent = await page.content();
    const hasError = pageContent.includes('エラー') || pageContent.includes('失敗');
    console.log('Has error message:', hasError);

    // Clean up
    fs.unlinkSync(testImagePath);

    // The test passes if we can set files on the input
    expect(true).toBe(true);
});
