/**
 * 売上CSVパーサー
 * 売上データの一括インポート用
 */

import iconv from 'iconv-lite';
import { Department, SalesChannel } from '@/types/supabase';

export interface ParsedSale {
    transaction_date: string;  // YYYY-MM-DD
    amount: number;
    department: Department;
    client_name: string;
    channel: SalesChannel;
    status: 'PAID' | 'UNPAID';
}

export interface SalesParseResult {
    success: boolean;
    sales: ParsedSale[];
    errors: string[];
    skippedRows: number;
}

/**
 * 売上CSVをパース
 * 想定フォーマット: 取引日, 金額, 事業区分, 取引先名, [入金状況]
 * エンコーディング: Shift-JIS または UTF-8 (自動判定)
 */
export function parseSalesCsv(buffer: Buffer): SalesParseResult {
    const result: SalesParseResult = {
        success: true,
        sales: [],
        errors: [],
        skippedRows: 0,
    };

    // エンコーディング自動判定
    let content: string;
    try {
        // まずUTF-8で試す
        content = buffer.toString('utf-8');
        // BOMがあれば除去
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        // 文字化けチェック（簡易）
        if (content.includes('�')) {
            throw new Error('UTF-8 decode failed');
        }
    } catch {
        // Shift-JISでデコード
        content = iconv.decode(buffer, 'Shift_JIS');
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        result.success = false;
        result.errors.push('データが見つかりません（ヘッダー行 + 1行以上必要）');
        return result;
    }

    // ヘッダー行を解析してカラム位置を特定
    const headerLine = lines[0].toLowerCase();
    const headers = parseCsvLine(headerLine);

    // カラムインデックスを特定
    const dateIndex = findColumnIndex(headers, ['取引日', '日付', 'date', '売上日']);
    const amountIndex = findColumnIndex(headers, ['金額', 'amount', '売上金額', '売上']);
    const deptIndex = findColumnIndex(headers, ['事業区分', '区分', 'department', '部門']);
    const clientIndex = findColumnIndex(headers, ['取引先', 'client', '取引先名', '顧客名', '顧客']);
    const channelIndex = findColumnIndex(headers, ['チャネル', 'channel', '受注経路', '受注チャネル', '経路']);
    const statusIndex = findColumnIndex(headers, ['入金状況', 'status', 'ステータス', '入金', '支払状況']);

    if (dateIndex === -1 || amountIndex === -1 || clientIndex === -1) {
        result.success = false;
        result.errors.push('必須カラムが見つかりません。取引日、金額、取引先は必須です。');
        return result;
    }

    // データ行をパース
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 3) {
            result.skippedRows++;
            continue;
        }

        try {
            const date = normalizeDate(cols[dateIndex]);
            if (!date) {
                result.errors.push(`行${i + 1}: 日付が不正です: ${cols[dateIndex]}`);
                result.skippedRows++;
                continue;
            }

            const amount = parseAmount(cols[amountIndex]);
            if (amount <= 0) {
                result.errors.push(`行${i + 1}: 金額が不正です: ${cols[amountIndex]}`);
                result.skippedRows++;
                continue;
            }

            const clientName = cols[clientIndex]?.trim();
            if (!clientName) {
                result.errors.push(`行${i + 1}: 取引先名が空です`);
                result.skippedRows++;
                continue;
            }

            // 事業区分（オプション、デフォルトはPHOTO）
            let department: Department = 'PHOTO';
            if (deptIndex !== -1 && cols[deptIndex]) {
                department = parseDepartment(cols[deptIndex]);
            }

            // 受注チャネル（オプション、デフォルトはDIRECT）
            let channel: SalesChannel = 'DIRECT';
            if (channelIndex !== -1 && cols[channelIndex]) {
                channel = parseChannel(cols[channelIndex]);
            }

            // 入金状況（オプション、デフォルトはUNPAID）
            let status: 'PAID' | 'UNPAID' = 'UNPAID';
            if (statusIndex !== -1 && cols[statusIndex]) {
                status = parseStatus(cols[statusIndex]);
            }

            result.sales.push({
                transaction_date: date,
                amount,
                department,
                client_name: clientName,
                channel,
                status,
            });
        } catch (error) {
            result.errors.push(`行${i + 1}: パースエラー`);
            result.skippedRows++;
        }
    }

    if (result.sales.length === 0) {
        result.success = false;
        result.errors.push('有効なデータが見つかりませんでした');
    }

    return result;
}

/**
 * ヘッダーからカラムインデックスを検索
 */
function findColumnIndex(headers: string[], candidates: string[]): number {
    for (const candidate of candidates) {
        const index = headers.findIndex(h =>
            h.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(h)
        );
        if (index !== -1) return index;
    }
    return -1;
}

/**
 * CSVの行をパース（カンマ区切り、ダブルクォート対応）
 */
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * 日付を YYYY-MM-DD 形式に変換
 */
function normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const cleaned = dateStr.trim();

    // YYYY/MM/DD or YYYY-MM-DD
    let match = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }

    // YYYYMMDD
    match = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // 和暦対応（R5.11.01 → 2023-11-01）
    match = cleaned.match(/^[RH](\d{1,2})[\.\/](\d{1,2})[\.\/](\d{1,2})$/);
    if (match) {
        const era = cleaned.startsWith('R') ? 2018 : 1988;
        const year = era + parseInt(match[1]);
        return `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }

    return null;
}

/**
 * 金額文字列を数値に変換
 */
function parseAmount(amountStr: string): number {
    if (!amountStr || amountStr.trim() === '') return 0;
    const cleaned = amountStr.replace(/[,円¥\s]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * 事業区分をパース
 */
function parseDepartment(deptStr: string): Department {
    const normalized = deptStr.trim().toUpperCase();

    if (normalized.includes('写真') || normalized === 'PHOTO') return 'PHOTO';
    if (normalized.includes('動画') || normalized === 'VIDEO') return 'VIDEO';
    if (normalized.includes('WEB') || normalized.includes('ウェブ')) return 'WEB';
    if (normalized.includes('共通') || normalized === 'COMMON') return 'COMMON';

    return 'PHOTO'; // デフォルト
}

/**
 * 受注チャネルをパース
 */
function parseChannel(channelStr: string): SalesChannel {
    const normalized = channelStr.trim().toUpperCase();

    if (normalized.includes('直接') || normalized === 'DIRECT') return 'DIRECT';
    if (normalized.includes('紹介') || normalized === 'REFERRAL') return 'REFERRAL';
    if (normalized.includes('SNS') || normalized.includes('INSTAGRAM') || normalized.includes('TWITTER')) return 'SNS';
    if (normalized.includes('WEB') || normalized.includes('サイト') || normalized === 'WEBSITE') return 'WEBSITE';
    if (normalized.includes('TOTTA') || normalized.includes('トッタ')) return 'PLATFORM_TOTTA';
    if (normalized.includes('くらし') || normalized.includes('クラシ') || normalized.includes('KURASHI') || normalized === 'PLATFORM_KURASHI') return 'PLATFORM_KURASHI';
    if (normalized.includes('リピート') || normalized === 'REPEAT') return 'REPEAT';

    return 'OTHER';
}

/**
 * 入金状況をパース
 */
function parseStatus(statusStr: string): 'PAID' | 'UNPAID' {
    const normalized = statusStr.trim().toUpperCase();

    if (normalized.includes('済') || normalized === 'PAID' || normalized === '入金済') return 'PAID';

    return 'UNPAID';
}

/**
 * サンプルCSVフォーマットを生成
 */
export function getSampleCsvFormat(): string {
    return `取引日,金額,事業区分,取引先名,チャネル,入金状況
2024/11/15,100000,写真,株式会社ABC,紹介,未入金
2024/11/20,200000,動画,株式会社XYZ,くらし,入金済
2024/12/01,150000,WEB,合同会社DEF,Totta,未入金`;
}
