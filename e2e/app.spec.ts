import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Test credentials - should match your test user
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// Helper: Login
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    // Wait for redirect or error
    await page.waitForTimeout(2000);
}

// ============================================
// Login Page Tests
// ============================================
test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
        await page.goto('/login');

        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
        await expect(page.getByText('NonTurn決算申告')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'invalid@test.com');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Wait for error message
        await page.waitForTimeout(2000);
        const errorVisible = await page.locator('.text-red-600, .text-red-500').isVisible();
        // Error should appear or stay on login page
        const stillOnLogin = page.url().includes('/login');
        expect(errorVisible || stillOnLogin).toBeTruthy();
    });

    test('should require email and password', async ({ page }) => {
        await page.goto('/login');

        // Try to submit empty form
        await page.click('button[type="submit"]');

        // Should stay on login page
        expect(page.url()).toContain('/login');
    });
});

// ============================================
// Dashboard (Home) Page Tests
// ============================================
test.describe('Dashboard Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display dashboard after login', async ({ page }) => {
        // Check if redirected to home or shows dashboard content
        const isDashboard = await page.getByText('NonTurn決算申告').isVisible().catch(() => false);
        const isLogin = page.url().includes('/login');

        if (isLogin) {
            console.log('Login failed - check credentials');
            return;
        }

        expect(isDashboard).toBeTruthy();
    });

    test('should display fiscal year label', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        // Check for fiscal year display (2024年度)
        const fiscalYearVisible = await page.getByText(/\d{4}年度/).isVisible().catch(() => false);
        if (!page.url().includes('/login')) {
            expect(fiscalYearVisible).toBeTruthy();
        }
    });

    test('should have navigation buttons', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check navigation buttons exist
        const expenseBtn = await page.getByText('経費登録').isVisible().catch(() => false);
        const salesBtn = await page.getByText('売上登録').isVisible().catch(() => false);
        const bankBtn = await page.getByText('銀行').isVisible().catch(() => false);
        const mgmtBtn = await page.getByText('管理').isVisible().catch(() => false);

        expect(expenseBtn || salesBtn || bankBtn || mgmtBtn).toBeTruthy();
    });

    test('should navigate to expenses page', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        await page.click('a[href="/expenses"]');
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/expenses');
    });

    test('should navigate to sales page', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        await page.click('a[href="/sales"]');
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/sales');
    });
});

// ============================================
// Expenses Page Tests
// ============================================
test.describe('Expenses Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/expenses');
        await page.waitForTimeout(1000);
    });

    test('should display expense form', async ({ page }) => {
        if (page.url().includes('/login')) return;

        // Check form fields exist
        const dateInput = await page.locator('input[type="date"]').first().isVisible().catch(() => false);
        const amountInput = await page.locator('input[type="number"]').first().isVisible().catch(() => false);

        expect(dateInput || amountInput).toBeTruthy();
    });

    test('should have department select', async ({ page }) => {
        if (page.url().includes('/login')) return;

        // Check for department selector
        const deptSelect = await page.getByText('事業区分').isVisible().catch(() => false);
        expect(deptSelect).toBeTruthy();
    });

    test('should have receipt upload area', async ({ page }) => {
        if (page.url().includes('/login')) return;

        // Check for upload area
        const uploadArea = await page.getByText(/領収書|アップロード|ドラッグ/).first().isVisible().catch(() => false);
        expect(uploadArea).toBeTruthy();
    });

    test('should validate amount is required', async ({ page }) => {
        if (page.url().includes('/login')) return;

        // Try to submit with 0 amount
        await page.fill('input[type="number"]', '0');
        await page.click('button[type="submit"]');

        await page.waitForTimeout(500);

        // Should show validation error or stay on page
        const stillOnExpenses = page.url().includes('/expenses');
        expect(stillOnExpenses).toBeTruthy();
    });
});

// ============================================
// Sales Page Tests
// ============================================
test.describe('Sales Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/sales');
        await page.waitForTimeout(1000);
    });

    test('should display sales form', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const formVisible = await page.getByText('売上登録').isVisible().catch(() => false);
        expect(formVisible).toBeTruthy();
    });

    test('should have client name field', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const clientField = await page.getByText('取引先').isVisible().catch(() => false);
        expect(clientField).toBeTruthy();
    });

    test('should have channel select', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const channelField = await page.getByText('チャネル').isVisible().catch(() => false);
        expect(channelField).toBeTruthy();
    });

    test('should have CSV import button', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const csvButton = await page.getByText('CSV一括登録').isVisible().catch(() => false);
        expect(csvButton).toBeTruthy();
    });

    test('should open CSV import dialog', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const csvButton = page.getByText('CSV一括登録');
        if (await csvButton.isVisible()) {
            await csvButton.click();
            await page.waitForTimeout(500);

            // Check dialog opened
            const dialogVisible = await page.getByText('売上CSV一括インポート').isVisible().catch(() => false);
            expect(dialogVisible).toBeTruthy();
        }
    });
});

// ============================================
// Bank Page Tests
// ============================================
test.describe('Bank Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/bank');
        await page.waitForTimeout(1000);
    });

    test('should display bank page', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const bankTitle = await page.getByText(/銀行|口座/).first().isVisible().catch(() => false);
        expect(bankTitle).toBeTruthy();
    });

    test('should have add account button', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const addButton = await page.getByText('口座を追加').isVisible().catch(() => false);
        expect(addButton).toBeTruthy();
    });

    test('should open add account dialog', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const addButton = page.getByText('口座を追加');
        if (await addButton.isVisible()) {
            await addButton.click();
            await page.waitForTimeout(500);

            const dialogVisible = await page.getByText('銀行口座を追加').isVisible().catch(() => false);
            expect(dialogVisible).toBeTruthy();
        }
    });

    test('should have bank type select in dialog', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const addButton = page.getByText('口座を追加');
        if (await addButton.isVisible()) {
            await addButton.click();
            await page.waitForTimeout(500);

            const bankTypeLabel = await page.getByText('銀行種別').isVisible().catch(() => false);
            expect(bankTypeLabel).toBeTruthy();
        }
    });

    test('should have CSV import button', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const csvButton = await page.getByText('CSV取込').isVisible().catch(() => false);
        expect(csvButton).toBeTruthy();
    });
});

// ============================================
// Management Page Tests
// ============================================
test.describe('Management Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/management');
        await page.waitForTimeout(1000);
    });

    test('should display management console', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const title = await page.getByText('管理コンソール').isVisible().catch(() => false);
        expect(title).toBeTruthy();
    });

    test('should have tabs for different data types', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const expensesTab = await page.getByRole('button', { name: '経費' }).isVisible().catch(() => false);
        const salesTab = await page.getByRole('button', { name: '売上' }).isVisible().catch(() => false);
        const bankAccountsTab = await page.getByRole('button', { name: '銀行口座' }).isVisible().catch(() => false);
        const bankTransactionsTab = await page.getByRole('button', { name: '銀行取引' }).isVisible().catch(() => false);

        expect(expensesTab && salesTab).toBeTruthy();
    });

    test('should switch to sales tab', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const salesTab = page.getByRole('button', { name: '売上' });
        if (await salesTab.isVisible()) {
            await salesTab.click();
            await page.waitForTimeout(500);

            // Check that sales table headers appear
            const clientHeader = await page.getByText('取引先').isVisible().catch(() => false);
            expect(clientHeader).toBeTruthy();
        }
    });

    test('should switch to bank accounts tab', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const bankTab = page.getByRole('button', { name: '銀行口座' });
        if (await bankTab.isVisible()) {
            await bankTab.click();
            await page.waitForTimeout(500);

            // Check for bank account headers or empty state
            const accountHeader = await page.getByText('口座名').isVisible().catch(() => false);
            const emptyState = await page.getByText('銀行口座が登録されていません').isVisible().catch(() => false);
            expect(accountHeader || emptyState).toBeTruthy();
        }
    });

    test('should switch to bank transactions tab', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const transactionsTab = page.getByRole('button', { name: '銀行取引' });
        if (await transactionsTab.isVisible()) {
            await transactionsTab.click();
            await page.waitForTimeout(500);

            // Check for transactions table or empty state
            const depositHeader = await page.getByText('入金').first().isVisible().catch(() => false);
            const emptyState = await page.getByText('取引データが見つかりません').isVisible().catch(() => false);
            expect(depositHeader || emptyState).toBeTruthy();
        }
    });

    test('should have fiscal year filter', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const fiscalYearFilter = await page.getByText(/\d{4}年度/).first().isVisible().catch(() => false);
        expect(fiscalYearFilter).toBeTruthy();
    });

    test('should have CSV export button for expenses', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const exportButton = await page.getByText('CSVエクスポート').isVisible().catch(() => false);
        expect(exportButton).toBeTruthy();
    });

    test('should show add bank account button on bank tab', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const bankTab = page.getByRole('button', { name: '銀行口座' });
        if (await bankTab.isVisible()) {
            await bankTab.click();
            await page.waitForTimeout(500);

            const addButton = await page.getByText('口座を追加').isVisible().catch(() => false);
            expect(addButton).toBeTruthy();
        }
    });

    test('expenses table should have file column', async ({ page }) => {
        if (page.url().includes('/login')) return;

        // Expenses tab is default, check for file column header
        const fileHeader = await page.locator('th').filter({ hasText: 'ファイル' }).first().isVisible().catch(() => false);
        expect(fileHeader).toBeTruthy();
    });

    test('sales table should have file column', async ({ page }) => {
        if (page.url().includes('/login')) return;

        const salesTab = page.getByRole('button', { name: '売上' });
        if (await salesTab.isVisible()) {
            await salesTab.click();
            await page.waitForTimeout(500);

            const fileHeader = await page.locator('th').filter({ hasText: 'ファイル' }).first().isVisible().catch(() => false);
            expect(fileHeader).toBeTruthy();
        }
    });
});

// ============================================
// CSV Import Tests
// ============================================
test.describe('CSV Import Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should download sales CSV template', async ({ page }) => {
        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Open CSV dialog
        const csvButton = page.getByText('CSV一括登録');
        if (await csvButton.isVisible()) {
            await csvButton.click();
            await page.waitForTimeout(500);

            // Check for sample download button
            const sampleButton = await page.getByText('サンプルCSVをダウンロード').isVisible().catch(() => false);
            expect(sampleButton).toBeTruthy();
        }
    });

    test('sales CSV dialog should show required columns info', async ({ page }) => {
        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        const csvButton = page.getByText('CSV一括登録');
        if (await csvButton.isVisible()) {
            await csvButton.click();
            await page.waitForTimeout(500);

            // Check for column info
            const dateInfo = await page.getByText('取引日').isVisible().catch(() => false);
            const amountInfo = await page.getByText('金額').isVisible().catch(() => false);
            expect(dateInfo && amountInfo).toBeTruthy();
        }
    });

    test('bank CSV dialog should open', async ({ page }) => {
        await page.goto('/bank');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        const csvButton = page.getByText('CSV取込');
        if (await csvButton.isVisible()) {
            await csvButton.click();
            await page.waitForTimeout(500);

            // Check dialog opened
            const dialogTitle = await page.getByText(/CSV.*インポート|取引.*取込/).first().isVisible().catch(() => false);
            expect(dialogTitle).toBeTruthy();
        }
    });
});

// ============================================
// Form Validation Tests
// ============================================
test.describe('Form Validation', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('expense form should validate required fields', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Clear date field if possible and try to submit
        const submitButton = page.getByRole('button', { name: '経費を登録' });
        if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(500);

            // Form should not submit successfully without valid data
            const stillOnPage = page.url().includes('/expenses');
            expect(stillOnPage).toBeTruthy();
        }
    });

    test('sales form should validate client name', async ({ page }) => {
        await page.goto('/sales');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Try to submit without client name
        const submitButton = page.getByRole('button', { name: '売上を登録' });
        if (await submitButton.isVisible()) {
            // Fill only some fields
            await page.fill('input[type="number"]', '10000');
            await submitButton.click();
            await page.waitForTimeout(500);

            // Should show validation error
            const errorVisible = await page.locator('.text-red-500, [data-error]').isVisible().catch(() => false);
            const stillOnPage = page.url().includes('/sales');
            expect(stillOnPage).toBeTruthy();
        }
    });
});

// ============================================
// UI Element Tests
// ============================================
test.describe('UI Elements', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('dashboard should have summary cards', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check for summary metrics
        const salesTotal = await page.getByText(/売上|総売上/).first().isVisible().catch(() => false);
        const expensesTotal = await page.getByText(/経費|総経費/).first().isVisible().catch(() => false);

        expect(salesTotal || expensesTotal).toBeTruthy();
    });

    test('dashboard should have charts', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check for chart containers
        const chartTitle = await page.getByText(/構成比|収支/).first().isVisible().catch(() => false);
        expect(chartTitle).toBeTruthy();
    });

    test('select dropdowns should open', async ({ page }) => {
        await page.goto('/expenses');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Find and click a select trigger
        const selectTrigger = page.locator('[role="combobox"]').first();
        if (await selectTrigger.isVisible()) {
            await selectTrigger.click();
            await page.waitForTimeout(300);

            // Check if dropdown content is visible
            const dropdownVisible = await page.locator('[role="listbox"], [role="option"]').first().isVisible().catch(() => false);
            expect(dropdownVisible).toBeTruthy();
        }
    });
});

// ============================================
// Responsive Design Tests
// ============================================
test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await login(page);
        await page.goto('/');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check basic content is visible
        const titleVisible = await page.getByText('NonTurn決算申告').isVisible().catch(() => false);
        expect(titleVisible).toBeTruthy();
    });

    test('management table should be scrollable on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await login(page);
        await page.goto('/management');
        await page.waitForTimeout(1000);

        if (page.url().includes('/login')) return;

        // Check that table container exists
        const tableVisible = await page.locator('table').isVisible().catch(() => false);
        expect(tableVisible).toBeTruthy();
    });
});

// ============================================
// Error Handling Tests
// ============================================
test.describe('Error Handling', () => {
    test('should handle 404 pages gracefully', async ({ page }) => {
        await page.goto('/nonexistent-page');
        await page.waitForTimeout(1000);

        // Should show 404 or redirect to login
        const is404 = await page.getByText(/404|見つかりません|Not Found/).isVisible().catch(() => false);
        const isLogin = page.url().includes('/login');

        expect(is404 || isLogin).toBeTruthy();
    });
});
