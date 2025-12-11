#!/usr/bin/env python3
"""
経費自動登録スクリプト
Playwright を使用して ShimeSettle に領収書を自動登録します。

使用方法:
    1. pip install playwright
    2. playwright install chromium
    3. 環境変数 SHIMESETTLE_PASSWORD を設定するか、実行時に入力
    4. python expense_auto_register.py
"""

import os
import sys
import time
import getpass
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout

# ============ 設定 ============
BASE_URL = "http://localhost:3000"
EMAIL = "snp.inc.info@gmail.com"
# 環境変数から取得、なければデフォルト値を使用
PASSWORD = os.environ.get("SHIMESETTLE_PASSWORD", "noritaka8")
RECEIPT_ROOT_DIR = "/Users/noritakasawada/Downloads/receipt"

# 処理対象のフォルダ名（空リストの場合は全ての数字フォルダを対象）
TARGET_FOLDERS = ["7", "8"]

# 待機時間設定（秒）
WAIT_AFTER_UPLOAD = 2  # アップロード後の初期待機
WAIT_FOR_AI_ANALYSIS = 30  # AI解析の最大待機時間
WAIT_AFTER_SUBMIT = 2  # 登録後の待機

# 対応する画像拡張子
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'}


def login(page: Page) -> bool:
    """ログイン処理"""
    print("ログイン中...")

    try:
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        time.sleep(1)

        # メールアドレス入力
        page.fill('input[id="email"]', EMAIL)
        time.sleep(0.3)

        # パスワード入力
        page.fill('input[id="password"]', PASSWORD)
        time.sleep(0.3)

        # ログインボタンクリック
        page.click('button[type="submit"]')

        # ログイン処理を待機
        time.sleep(3)

        # ダッシュボードまたは経費ページへの遷移を待つ
        try:
            page.wait_for_url(lambda url: "/login" not in url, timeout=15000)
        except:
            pass

        # 現在のURLを確認
        current_url = page.url
        print(f"  現在のURL: {current_url}")

        # ログイン成功確認（ログインページにいないことを確認）
        if "/login" not in current_url:
            print("ログイン成功!")
            return True
        else:
            # エラーメッセージがあるか確認
            error_el = page.locator('.text-red-600')
            if error_el.count() > 0:
                print(f"ログインエラー: {error_el.first.inner_text()}")
            else:
                print("ログイン失敗: ログインページから遷移しませんでした")
            return False

    except Exception as e:
        print(f"ログインエラー: {e}")
        return False


def wait_for_ai_analysis(page: Page) -> tuple[bool, str, str]:
    """AI解析完了を待機し、結果（日付、金額）を返す"""
    print("  AI解析を待機中...")

    start_time = time.time()

    while time.time() - start_time < WAIT_FOR_AI_ANALYSIS:
        try:
            # AI解析中のインジケーターをチェック
            analyzing_indicator = page.locator('text=AIが領収書を解析中')

            if analyzing_indicator.count() == 0:
                # 解析インジケーターが消えた = 解析完了
                # 金額フィールドに値が入っているか確認
                amount_input = page.locator('input[name="amount"]')
                date_input = page.locator('input[name="transaction_date"]')
                
                amount_value = amount_input.input_value()
                date_value = date_input.input_value()

                # 金額が入っていれば完了とみなす (0も許可)
                if amount_value:
                    print(f"  AI解析完了: 日付={date_value}, 金額=¥{amount_value}")
                    return True, date_value, amount_value

            time.sleep(0.5)

        except Exception:
            pass

    print("  AI解析タイムアウト（強制続行）")
    return False, "", ""


def upload_receipt(page: Page, file_path: Path, folder_number: str, existing_counts: dict) -> bool:
    """領収書をアップロードして登録"""
    print(f"  ファイル: {file_path.name}")

    try:
        # ファイルアップロード（input[type=file] を探す）
        file_input = page.locator('input[type="file"]').first
        file_input.set_input_files(str(file_path))

        # アップロード後の初期待機
        time.sleep(WAIT_AFTER_UPLOAD)

        # AI解析完了を待機
        success, date_val, amount_val = wait_for_ai_analysis(page)
        
        # 重複チェック
        key = (date_val, amount_val)
        if success and key in existing_counts and existing_counts[key] > 0:
            existing_counts[key] -= 1
            print(f"  [スキップ] 既に登録済みです (日付: {date_val}, 金額: {amount_val}, 残り: {existing_counts[key]})")
            return "skipped" # Special return value

        # フォルダー番号を入力
        folder_input = page.locator('input[name="folder_number"]')
        if folder_input.count() > 0:
            folder_input.fill(folder_number)
            print(f"  フォルダー番号: {folder_number}")

        # 登録ボタンをクリック
        submit_button = page.locator('button[type="submit"]:has-text("経費を登録")')

        if submit_button.count() > 0:
            submit_button.click()

            # 登録完了を待機（ボタンが「登録完了」に変わるか、フォームがリセットされる）
            try:
                # 成功メッセージまたはフォームリセットを待つ
                page.wait_for_selector('text=登録完了', timeout=5000)
                print("  登録成功!")
            except PlaywrightTimeout:
                # タイムアウトしても続行（登録は成功している可能性あり）
                print("  登録処理完了（確認待ちタイムアウト）")

            time.sleep(WAIT_AFTER_SUBMIT)
            return True
        else:
            print("  登録ボタンが見つかりません")
            return False

    except Exception as e:
        print(f"  エラー: {e}")
        return False


def clear_form_if_needed(page: Page):
    """フォームをクリア（次のアップロードの準備）"""
    try:
        # クリアボタン（X）があればクリック
        clear_button = page.locator('button:has(.lucide-x)').first
        if clear_button.count() > 0 and clear_button.is_visible():
            clear_button.click()
            time.sleep(0.5)
    except Exception:
        pass


def process_folder(page: Page, folder_path: Path, existing_counts: dict) -> dict:
    """フォルダ内の画像を処理"""
    folder_name = folder_path.name
    print(f"\n=== フォルダ: {folder_name} ===")

    results = {"success": 0, "failed": 0, "skipped": 0}

    # フォルダ内の画像ファイルを取得
    image_files = sorted([
        f for f in folder_path.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    ])

    if not image_files:
        print("  画像ファイルが見つかりません")
        results["skipped"] = 1
        return results

    print(f"  {len(image_files)}件の画像を処理します")

    for i, image_file in enumerate(image_files, 1):
        print(f"\n--- [{i}/{len(image_files)}] ---")

        # フォームをクリア
        clear_form_if_needed(page)

        # アップロード & 登録
        result = upload_receipt(page, image_file, folder_name, existing_counts)

        if result == "skipped":
            results["skipped"] += 1
        elif result:
            results["success"] += 1
        else:
            results["failed"] += 1

        # 次の処理前に少し待機
        time.sleep(1)

    return results


def main():
    """メイン処理"""
    print("=" * 50)
    print("経費自動登録スクリプト")
    print("=" * 50)

    # パスワードチェック
    global PASSWORD
    if not PASSWORD:
        PASSWORD = getpass.getpass(f"\n{EMAIL} のパスワードを入力: ")

    if not PASSWORD:
        print("\nエラー: パスワードが入力されていません")
        sys.exit(1)

    # ルートディレクトリの確認
    root_path = Path(RECEIPT_ROOT_DIR)
    if not root_path.exists():
        print(f"\nエラー: ディレクトリが見つかりません: {RECEIPT_ROOT_DIR}")
        sys.exit(1)

    # フォルダ一覧を取得（数字または全角数字で始まるフォルダのみ）
    def is_digit_folder(name: str) -> bool:
        if not name:
            return False
        first_char = name[0]
        # 半角数字または全角数字をチェック
        return first_char.isdigit() or first_char in '０１２３４５６７８９'

    raw_folders = [f for f in root_path.iterdir() if f.is_dir()]
    
    folders = []
    if TARGET_FOLDERS:
        # 指定されたフォルダのみ
        folders = sorted([
            f for f in raw_folders 
            if f.name in TARGET_FOLDERS
        ], key=lambda x: x.name)
    else:
        # 数字フォルダ全て
        folders = sorted([
            f for f in raw_folders 
            if is_digit_folder(f.name)
        ], key=lambda x: x.name)

    if not folders:
        target_msg = f"指定フォルダ: {TARGET_FOLDERS}" if TARGET_FOLDERS else "数字フォルダ"
        print(f"\nエラー: 処理対象のフォルダが見つかりません。パス: {RECEIPT_ROOT_DIR}, 対象: {target_msg}")
        sys.exit(1)

    print(f"\n処理対象フォルダ: {len(folders)}件")
    for f in folders:
        print(f"  - {f.name}")

    # Playwright 開始
    with sync_playwright() as p:
        # ブラウザ起動（headed=True で表示、デバッグ時に便利）
        browser = p.chromium.launch(headless=False, slow_mo=100)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        try:
            # ログイン
            if not login(page):
                print("\nログインに失敗しました。終了します。")
                browser.close()
                sys.exit(1)

            # 経費ページへ移動
            print("\n既存の経費データを取得中...")
            page.goto(f"{BASE_URL}/management", wait_until="networkidle")
            time.sleep(2)
            
            # 登録済み経費を取得 ((date, amount): count の辞書)
            existing_counts = {}
            try:
                # 行を取得
                rows = page.locator('tbody tr')
                count = rows.count()
                print(f"  {count}件の既存データを確認")
                
                for i in range(count):
                    row = rows.nth(i)
                    # 3列目: 取引日, 7列目: 金額
                    date_text = row.locator('td').nth(2).inner_text().strip()
                    amount_text = row.locator('td').nth(6).inner_text().strip()
                    
                    # 金額のフォーマット解除 (¥1,234 -> 1234)
                    amount_val = amount_text.replace('¥', '').replace(',', '').strip()
                    
                    if date_text and amount_val:
                        key = (date_text, amount_val)
                        existing_counts[key] = existing_counts.get(key, 0) + 1
                        
            except Exception as e:
                print(f"  既存データの取得に失敗（スキップします）: {e}")

            print(f"  -> {len(existing_counts)}種類のユニークな経費セットを確認しました")

            # 経費登録ページへ移動
            print("\n経費登録ページへ移動...")
            page.goto(f"{BASE_URL}/expenses", wait_until="networkidle")
            time.sleep(2)

            # 「1枚ずつ登録」タブを選択（デフォルトで選択されているはず）
            single_tab = page.locator('button[role="tab"]:has-text("1枚ずつ登録")')
            if single_tab.count() > 0:
                single_tab.click()
                time.sleep(0.5)

            # 全体の結果
            total_results = {"success": 0, "failed": 0, "skipped": 0}

            # 各フォルダを処理
            for folder in folders:
                results = process_folder(page, folder, existing_counts)
                total_results["success"] += results["success"]
                total_results["failed"] += results["failed"]
                total_results["skipped"] += results["skipped"]

            # 結果サマリー
            print("\n" + "=" * 50)
            print("処理完了!")
            print("=" * 50)
            print(f"成功: {total_results['success']}件")
            print(f"失敗: {total_results['failed']}件")
            print(f"スキップ: {total_results['skipped']}件")

        except KeyboardInterrupt:
            print("\n\n処理が中断されました")
        except Exception as e:
            print(f"\n予期しないエラー: {e}")
        finally:
            # ブラウザを閉じる前に少し待機（結果確認用）
            print("\n5秒後にブラウザを閉じます...")
            time.sleep(5)
            browser.close()


if __name__ == "__main__":
    main()
