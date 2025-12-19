import { test, expect } from '@playwright/test';

test.describe('AI Chat Feature', () => {
    test.beforeEach(async ({ page }) => {
        // モックAPIの設定
        await page.route('/api/chat', async (route) => {
            const json = {
                conversationId: 'mock-conv-id',
                message: {
                    id: 'ai-response-1',
                    role: 'assistant',
                    content: 'これはAIの回答です',
                    timestamp: new Date().toISOString(),
                },
            };
            await route.fulfill({ json });
        });

        // ページにアクセス
        await page.goto('/login');

        // フォームが表示されるまで待つ
        await page.waitForSelector('input[id="email"]', { state: 'visible' });

        // ログイン
        await page.fill('input[id="email"]', 'snp.inc.info@gmail.com');
        await page.fill('input[id="password"]', 'noritaka8');
        await page.click('button[type="submit"]');

        // ダッシュボードへの遷移を待つ - /login 以外のURLになるまで待機
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
    });

    test('widget visibility toggle', async ({ page }) => {
        // 初期状態では閉じている
        const widget = page.locator('button[aria-label="チャットを開く"]');
        await expect(widget).toBeVisible();
        await expect(page.locator('text=AIアカウンタント')).not.toBeVisible();

        // 開く
        await widget.click();
        await expect(page.locator('text=財務データについて何でも聞いてください')).toBeVisible();

        // 閉じる
        await page.locator('button[aria-label="閉じる"]').click();
        await expect(page.locator('text=財務データについて何でも聞いてください')).not.toBeVisible();
    });

    test('send message and receive response', async ({ page }) => {
        // チャットを開く
        await page.locator('button[aria-label="チャットを開く"]').click();

        // メッセージ入力
        const input = page.locator('textarea[placeholder="質問を入力..."]');
        await input.fill('こんにちは');

        // 送信
        await page.locator('button[aria-label="送信"]').click();

        // ユーザーのメッセージが表示されること
        await expect(page.locator('text=こんにちは')).toBeVisible();

        // AIの回答が表示されること（モック）
        await expect(page.locator('text=これはAIの回答です')).toBeVisible();
    });

    test('local storage persistence', async ({ page }) => {
        // 1. メッセージを送信
        await page.locator('button[aria-label="チャットを開く"]').click();
        await page.locator('textarea[placeholder="質問を入力..."]').fill('保存テスト');
        await page.locator('button[aria-label="送信"]').click();
        await expect(page.locator('text=保存テスト')).toBeVisible();

        // 2. リロード
        await page.reload();

        // 3. チャットを開く
        await page.locator('button[aria-label="チャットを開く"]').click();

        // 4. メッセージが残っていることを確認
        await expect(page.locator('text=保存テスト')).toBeVisible();
    });
});
