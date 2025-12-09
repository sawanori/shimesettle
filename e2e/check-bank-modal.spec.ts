import { test, expect } from '@playwright/test';

test('check bank account modal category buttons', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'snp.inc.info@gmail.com');
    await page.fill('input[type="password"]', 'noritaka8');
    await page.click('button[type="submit"]');

    // Wait for redirect to home
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });

    // Go to bank page
    await page.goto('http://localhost:3000/bank');
    await page.waitForLoadState('networkidle');

    // Click "口座を追加" button
    await page.click('button:has-text("口座を追加")');

    // Wait for modal to open
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ timeout: 5000 });

    // Take screenshot of the modal
    await page.screenshot({ path: 'e2e/screenshots/bank-modal-initial.png', fullPage: false });

    // Find the category buttons INSIDE the dialog (not tabs)
    const businessButton = dialog.locator('button:has-text("ビジネス")');
    const personalButton = dialog.locator('button:has-text("個人")');

    // Get initial styles
    const businessStyle = await businessButton.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
        };
    });
    console.log('Business button initial style:', businessStyle);

    const personalStyle = await personalButton.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
        };
    });
    console.log('Personal button initial style:', personalStyle);

    // Click Personal button
    await personalButton.click();
    await page.waitForTimeout(500);

    // Take screenshot after clicking Personal
    await page.screenshot({ path: 'e2e/screenshots/bank-modal-personal-selected.png', fullPage: false });

    // Get styles after clicking Personal
    const businessStyleAfter = await dialog.locator('button:has-text("ビジネス")').evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
        };
    });
    console.log('Business button after Personal click:', businessStyleAfter);

    const personalStyleAfter = await dialog.locator('button:has-text("個人")').evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
        };
    });
    console.log('Personal button after Personal click:', personalStyleAfter);

    // Click Business button
    await dialog.locator('button:has-text("ビジネス")').click();
    await page.waitForTimeout(500);

    // Take screenshot after clicking Business
    await page.screenshot({ path: 'e2e/screenshots/bank-modal-business-selected.png', fullPage: false });
});
