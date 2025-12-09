
import { chromium, type Page, type BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';

// コマンドライン引数の解析
const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
        folder: {
            type: 'string',
            short: 'f',
        },
        headless: {
            type: 'boolean',
            short: 'h',
            default: false,
        },
    },
});

const FOLDER_PATH = values.folder;
const HEADLESS = values.headless;

if (!FOLDER_PATH) {
    console.error('エラー: 画像フォルダのパスを指定してください。');
    console.error('使用法: npx tsx scripts/bulk-upload-sales.ts --folder <フォルダパス>');
    process.exit(1);
}

// 許可する拡張子
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];

/**
 * 画像・PDFファイルを取得する関数
 */
function getFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        console.error(`エラー: フォルダ "${dir}" が見つかりません。`);
        process.exit(1);
    }

    const files = fs.readdirSync(dir);
    return files
        .filter((file) => ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase()))
        .map((file) => path.join(dir, file));
}

/**
 * 個別のファイルを処理する関数
 */
async function processFile(page: Page, filePath: string, index: number, total: number) {
    const fileName = path.basename(filePath);
    console.log(`[${index + 1}/${total}] 処理中: ${fileName}`);

    try {
        // 1. ファイルアップロード
        // input[type="file"] を探してファイルをセット
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
        console.log(`  - アップロード完了`);

        // 2. AI解析待ち
        // 金額(amount)フィールドに値が入るのを待つ
        // 初期状態は空あるいは0、AI解析完了で数値が入るはず
        console.log(`  - AI解析中...（しばらくお待ちください）`);

        // 金額入力欄を取得（name="amount" を想定）
        const amountInput = page.locator('input[name="amount"]');

        // 値が入力されるまで待機 (最大60秒)
        // 条件: valueが空でなく、かつ "0" でないこと
        await amountInput.waitFor({ state: 'visible', timeout: 60000 });

        // Check for value using pure browser function without passing Locator as argument
        await page.waitForFunction(
            () => {
                const input = document.querySelector('input[name="amount"]') as HTMLInputElement;
                return input && input.value && input.value !== '' && input.value !== '0';
            },
            null,
            { timeout: 60000 }
        );

        // 解析結果のログ出力
        const amount = await amountInput.inputValue();
        const dateInput = page.locator('button[id="date"]'); // カレンダーのトリガーボタンなどを想定、あるいはhidden inputか
        // 注: shadcn/ui の Calendar は hidden input かもしれないが、ここでは金額が入れば解析完了とみなす

        console.log(`  - 解析完了: 金額 ¥${amount}`);

        // 3. フォーム送信
        // "売上を登録" ボタンをクリック (テキストで探す)
        const submitButton = page.getByRole('button', { name: '売上を登録' });

        // ボタンがenableになるのを念の為確認
        await submitButton.waitFor({ state: 'visible' });
        await submitButton.click();
        console.log(`  - 登録ボタン押下`);

        // 4. 完了待ち
        // "登録完了" のテキストが出るか、トーストが出るのを待つ
        // ボタンのテキストが "登録完了" に変わるロジックがあるためそれを検知
        await page.getByText('登録完了', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
        console.log(`  - 登録成功！`);

        // 次のファイルのために少し待機してからリロードまたは状態リセット
        // ページをリロードしてフォームをクリアするのが確実
        await page.reload();
        await page.waitForLoadState('networkidle');

    } catch (error) {
        console.error(`  - エラー: ${fileName} の処理に失敗しました。`, error);
        // エラー時はページをリロードして次へ
        await page.reload();
    }
}

async function main() {
    const files = getFiles(FOLDER_PATH!);
    if (files.length === 0) {
        console.log('処理対象のファイルが見つかりませんでした。');
        return;
    }

    console.log(`合計 ${files.length} ファイルを処理します。`);
    console.log('ブラウザを起動中...');

    // 既存のChromeプロファイルを使用してみる（Mac用パス）
    // ユーザーデータディレクトリを指定することでログイン状態を維持
    const userDataDir = path.join(process.env.HOME || '', 'Library/Application Support/Google/Chrome');

    let context: BrowserContext;
    let browser;

    try {
        // 永続コンテキストで起動（ログイン状態維持のため）
        context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chrome', // Chromeを使用
            headless: HEADLESS,
            viewport: { width: 1280, height: 800 },
            // 既存のChromeが起動しているとロックエラーになるため、その場合は新規プロファイルで起動するフォールバックが必要かも
            // だが、今回はユーザー自身のプロファイルを使いたいので、一度Chromeを閉じてもらうのがベスト
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    } catch (e) {
        console.log('既存のChromeプロファイルで起動できませんでした。Chromeを完全に終了してから再実行するか、ログイン処理を行ってください。');
        console.log('一時的なプロファイルで起動します...');

        browser = await chromium.launch({ headless: HEADLESS, channel: 'chrome' });
        context = await browser.newContext();
    }

    const page = await context.newPage();

    // ログインページへ移動してログイン状態確認
    // 本番URLではなくローカルホストを想定
    const TARGET_URL = 'http://localhost:3000/sales';

    try {
        console.log(`${TARGET_URL} にアクセス中...`);
        await page.goto(TARGET_URL);

        // URLが /login にリダイレクトされたらログインが必要
        if (page.url().includes('/login')) {
            console.log('ログインが必要です。ブラウザでログインしてください。');
            console.log('ログイン完了後、Enterキーを押して続行してください...');

            // ユーザー入力待ち
            await new Promise<void>(resolve => {
                process.stdin.once('data', () => {
                    resolve();
                });
            });

            // 再度Salesページへ
            await page.goto(TARGET_URL);
        }

        // 処理ループ
        for (let i = 0; i < files.length; i++) {
            await processFile(page, files[i], i, files.length);
        }

        console.log('全ての処理が完了しました。');

    } catch (error) {
        console.error('実行中にエラーが発生しました:', error);
    } finally {
        // 終了
        console.log('ブラウザを終了します。');
        await context.close();
        if (browser) await browser.close();
        process.exit(0);
    }
}

main();
