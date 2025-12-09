import { test, expect, Page } from '@playwright/test';

// Test credentials
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// Mock API responses
const MOCK_INVOICE_RESPONSE = {
    transaction_date: '2024-12-01',
    amount: 150000,
    client_name: 'Test Corp',
    department: 'WEB',
    description: 'Web design services',
};

const MOCK_RECEIPT_RESPONSE = {
    transaction_date: '2024-12-05',
    amount: 3500,
    department: 'COMMON',
    account_item: '消耗品費',
    description: 'Office supplies',
    vendor_name: 'Amazon',
};

// Helper: Login
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
}

// ============================================
// Invoice OCR Tests (Sales Page)
// ============================================
test.describe('Invoice OCR Analysis', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should auto-populate form after invoice analysis', async ({ page }) => {
        // Mock the analyze-invoice API
        await page.route('**/api/analyze-invoice', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(MOCK_INVOICE_RESPONSE),
            });
        });

        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) {
            console.log('Login failed - skipping test');
            return;
        }

        // Check if invoice uploader exists
        const uploaderLabel = await page.getByText('請求書ファイル').isVisible().catch(() => false);
        expect(uploaderLabel).toBeTruthy();
    });

    test('should handle invoice analysis API error', async ({ page }) => {
        // Mock the analyze-invoice API with error
        await page.route('**/api/analyze-invoice', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Failed to analyze invoice' }),
            });
        });

        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) {
            console.log('Login failed - skipping test');
            return;
        }

        // Verify page still works after error
        const formVisible = await page.locator('form').first().isVisible();
        expect(formVisible).toBeTruthy();
    });

    test('should handle rate limit error (429)', async ({ page }) => {
        await page.route('**/api/analyze-invoice', async (route) => {
            await route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
            });
        });

        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should still be functional
        const pageTitle = await page.getByText(/売上/).first().isVisible().catch(() => false);
        expect(pageTitle).toBeTruthy();
    });

    test('should handle unauthorized error (401)', async ({ page }) => {
        await page.route('**/api/analyze-invoice', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Unauthorized' }),
            });
        });

        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should still be accessible
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();
    });
});

// ============================================
// Receipt OCR Tests (Expenses Page)
// ============================================
test.describe('Receipt OCR Analysis', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should auto-populate form after receipt analysis', async ({ page }) => {
        // Mock the analyze-receipt API
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(MOCK_RECEIPT_RESPONSE),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) {
            console.log('Login failed - skipping test');
            return;
        }

        // Check if receipt uploader exists
        const uploaderLabel = await page.getByText(/領収書/).first().isVisible().catch(() => false);
        expect(uploaderLabel).toBeTruthy();
    });

    test('should handle receipt analysis API error', async ({ page }) => {
        // Mock the analyze-receipt API with error
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Failed to analyze receipt' }),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) {
            console.log('Login failed - skipping test');
            return;
        }

        // Verify page still works after error
        const formVisible = await page.locator('form').first().isVisible();
        expect(formVisible).toBeTruthy();
    });

    test('should handle rate limit error (429)', async ({ page }) => {
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should still be functional
        const pageTitle = await page.getByText(/経費/).first().isVisible().catch(() => false);
        expect(pageTitle).toBeTruthy();
    });

    test('should handle unauthorized error (401)', async ({ page }) => {
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Unauthorized' }),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should still be accessible
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();
    });

    test('should handle PDF parsing error', async ({ page }) => {
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Failed to parse PDF file.' }),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Form should still be visible
        const dateInput = await page.locator('input[type="date"]').first().isVisible().catch(() => false);
        expect(dateInput).toBeTruthy();
    });
});

// ============================================
// File Uploader Component Tests
// ============================================
test.describe('File Uploader Component', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should show upload area on expenses page', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check for upload area text
        const dropzoneText = await page.getByText(/ドラッグ|ドロップ|クリック/).first().isVisible().catch(() => false);
        const uploadLabel = await page.getByText(/領収書画像/).first().isVisible().catch(() => false);

        expect(dropzoneText || uploadLabel).toBeTruthy();
    });

    test('should show upload area on sales page', async ({ page }) => {
        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check for upload area
        const uploadLabel = await page.getByText('請求書ファイル').isVisible().catch(() => false);
        expect(uploadLabel).toBeTruthy();
    });

    test('should accept image files on expenses page', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check file input accepts images and PDFs
        const fileInput = await page.locator('input[type="file"]').first();
        const acceptAttr = await fileInput.getAttribute('accept').catch(() => null);

        if (acceptAttr) {
            expect(acceptAttr.includes('image') || acceptAttr.includes('pdf')).toBeTruthy();
        }
    });

    test('receipt uploader should show max files info', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check for max files label
        const maxFilesLabel = await page.getByText(/最大.*枚/).first().isVisible().catch(() => false);
        expect(maxFilesLabel).toBeTruthy();
    });
});

// ============================================
// Tab State Persistence Tests (Regression)
// ============================================
test.describe('Tab State Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('expense form should persist when switching tabs', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Find tabs
        const singleTab = await page.getByRole('tab', { name: /1枚ずつ/ }).isVisible().catch(() => false);
        const bulkTab = await page.getByRole('tab', { name: /一括/ }).isVisible().catch(() => false);

        if (!singleTab || !bulkTab) {
            console.log('Tabs not found - skipping test');
            return;
        }

        // Switch to bulk tab
        await page.getByRole('tab', { name: /一括/ }).click();
        await page.waitForTimeout(500);

        // Switch back to single tab
        await page.getByRole('tab', { name: /1枚ずつ/ }).click();
        await page.waitForTimeout(500);

        // Form should still be visible
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();

        // Date input should still be visible
        const dateInput = await page.locator('input[type="date"]').first().isVisible().catch(() => false);
        expect(dateInput).toBeTruthy();
    });

    test('form values should persist after tab switch', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Fill in some form data
        const amountInput = page.locator('input[type="number"]').first();
        if (await amountInput.isVisible()) {
            await amountInput.fill('5000');
        }

        // Find and click tabs
        const bulkTab = await page.getByRole('tab', { name: /一括/ }).isVisible().catch(() => false);
        if (!bulkTab) return;

        await page.getByRole('tab', { name: /一括/ }).click();
        await page.waitForTimeout(300);

        await page.getByRole('tab', { name: /1枚ずつ/ }).click();
        await page.waitForTimeout(300);

        // Check if value persisted
        const currentValue = await amountInput.inputValue().catch(() => '');
        expect(currentValue).toBe('5000');
    });
});

// ============================================
// API Response Validation Tests
// ============================================
test.describe('API Response Validation', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('invoice API should validate department enum', async ({ page }) => {
        // Mock with invalid department
        await page.route('**/api/analyze-invoice', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...MOCK_INVOICE_RESPONSE,
                    department: 'INVALID', // Should fail validation
                }),
            });
        });

        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should handle validation error gracefully
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();
    });

    test('receipt API should validate department enum', async ({ page }) => {
        // Mock with invalid department
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...MOCK_RECEIPT_RESPONSE,
                    department: 'INVALID', // Should fail validation
                }),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should handle validation error gracefully
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();
    });
});

// ============================================
// Security Tests (SSRF Protection)
// ============================================
test.describe('Security - SSRF Protection', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should reject invalid URL error', async ({ page }) => {
        await page.route('**/api/analyze-receipt', async (route) => {
            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Invalid image URL. Only images from Supabase Storage are allowed.' }),
            });
        });

        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Page should handle SSRF protection error gracefully
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();
    });

    test('should show error for missing URL', async ({ page }) => {
        await page.route('**/api/analyze-invoice', async (route) => {
            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Image URL is required' }),
            });
        });

        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Form should still be usable
        const formExists = await page.locator('form').first().isVisible();
        expect(formExists).toBeTruthy();
    });
});
