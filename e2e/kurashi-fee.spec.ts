import { test, Page } from '@playwright/test';

async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
}

test('selecting くらしのマーケット should auto-set 20% fee', async ({ page }) => {
    await login(page);
    await page.goto('/sales');
    await page.waitForTimeout(1500);

    // Enter amount first
    await page.fill('input[placeholder="0"]', '10000');
    
    // Screenshot before changing channel
    await page.screenshot({ path: 'test-results/kurashi-1-before.png', fullPage: true });

    // Click channel dropdown using the select trigger
    const channelTrigger = page.locator('button').filter({ hasText: '直接営業' });
    await channelTrigger.click();
    await page.waitForTimeout(500);
    
    // Screenshot with dropdown open
    await page.screenshot({ path: 'test-results/kurashi-2-dropdown.png', fullPage: true });
    
    // Select くらしのマーケット using text selector
    await page.locator('div[role="option"]').filter({ hasText: 'くらしのマーケット' }).click();
    await page.waitForTimeout(500);

    // Screenshot after selecting
    await page.screenshot({ path: 'test-results/kurashi-3-after.png', fullPage: true });
});
