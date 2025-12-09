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

test('Sales page - test drag and drop', async ({ page }) => {
    await login(page);
    await page.goto('/sales');
    await page.waitForTimeout(1500);

    // Create a test image
    const testImagePath = path.join(__dirname, 'test-drag-drop.png');
    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
        0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngBuffer);

    // Find the drop zone
    const dropZone = page.locator('.border-dashed').first();
    
    // Screenshot before
    await page.screenshot({ path: 'test-results/drag-drop-1-before.png', fullPage: true });

    // Read file as buffer for DataTransfer
    const fileBuffer = fs.readFileSync(testImagePath);
    
    // Create a DataTransfer and drop event
    const dataTransfer = await page.evaluateHandle(async (data) => {
        const dt = new DataTransfer();
        const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
        const file = new File([blob], 'test-drag-drop.png', { type: 'image/png' });
        dt.items.add(file);
        return dt;
    }, Array.from(fileBuffer));

    // Dispatch drag events
    await dropZone.dispatchEvent('dragenter', { dataTransfer });
    await page.waitForTimeout(100);
    
    await page.screenshot({ path: 'test-results/drag-drop-2-dragover.png', fullPage: true });
    
    await dropZone.dispatchEvent('dragover', { dataTransfer });
    await page.waitForTimeout(100);
    
    await dropZone.dispatchEvent('drop', { dataTransfer });
    await page.waitForTimeout(3000);

    // Screenshot after drop
    await page.screenshot({ path: 'test-results/drag-drop-3-after.png', fullPage: true });

    // Check if preview appeared
    const previewImg = page.locator('img[alt="Preview"]');
    const previewVisible = await previewImg.isVisible().catch(() => false);
    console.log('Preview after drag-drop:', previewVisible);

    // Clean up
    fs.unlinkSync(testImagePath);
});
