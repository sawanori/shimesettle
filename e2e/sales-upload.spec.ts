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

test.describe('Sales Page - File Upload', () => {
    test('should upload file via drag and drop or file input', async ({ page }) => {
        await login(page);
        await page.goto('/sales');
        await page.waitForTimeout(1500);

        // Screenshot before upload
        await page.screenshot({ path: 'test-results/sales-upload-1-before.png', fullPage: true });

        // Create a test image file
        const testImagePath = path.join(__dirname, 'test-image.png');
        
        // Create a simple 1x1 PNG image for testing
        const pngBuffer = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
            0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00,
            0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        fs.writeFileSync(testImagePath, pngBuffer);

        // Find the file input (it might be hidden)
        const fileInput = page.locator('input[type="file"]').first();
        
        // Check if file input exists
        const inputCount = await page.locator('input[type="file"]').count();
        console.log('File input count:', inputCount);

        if (inputCount > 0) {
            // Try to upload via file input
            await fileInput.setInputFiles(testImagePath);
            await page.waitForTimeout(2000);
            
            // Screenshot after attempting upload
            await page.screenshot({ path: 'test-results/sales-upload-2-after-input.png', fullPage: true });
        }

        // Also try clicking the upload area
        const uploadArea = page.locator('text=クリック または ドラッグ＆ドロップ').first();
        const uploadAreaVisible = await uploadArea.isVisible().catch(() => false);
        console.log('Upload area visible:', uploadAreaVisible);

        if (uploadAreaVisible) {
            // Try clicking on the upload area
            await uploadArea.click();
            await page.waitForTimeout(500);
            
            // Screenshot after click
            await page.screenshot({ path: 'test-results/sales-upload-3-after-click.png', fullPage: true });
        }

        // Clean up test file
        fs.unlinkSync(testImagePath);
    });

    test('check upload component structure', async ({ page }) => {
        await login(page);
        await page.goto('/sales');
        await page.waitForTimeout(1500);

        // Get all file inputs
        const fileInputs = await page.locator('input[type="file"]').all();
        console.log('Number of file inputs:', fileInputs.length);

        for (let i = 0; i < fileInputs.length; i++) {
            const isVisible = await fileInputs[i].isVisible();
            const isHidden = await fileInputs[i].getAttribute('hidden');
            const className = await fileInputs[i].getAttribute('class');
            console.log(`File input ${i}: visible=${isVisible}, hidden=${isHidden}, class=${className}`);
        }

        // Check for drop zone element
        const dropZone = page.locator('[class*="border-dashed"]').first();
        const dropZoneExists = await dropZone.count() > 0;
        console.log('Drop zone exists:', dropZoneExists);

        await page.screenshot({ path: 'test-results/sales-upload-structure.png', fullPage: true });
    });
});
