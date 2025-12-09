/**
 * 銀行CSVパーサー
 * 主要銀行のCSVフォーマットに対応
 */

import { BankType } from '@/types/supabase';
import iconv from 'iconv-lite';
import crypto from 'crypto';

export interface ParsedTransaction {
    transaction_date: string;  // YYYY-MM-DD
    description: string;
    withdrawal: number;        // 出金
    deposit: number;           // 入金
    balance: number | null;    // 残高
    import_hash: string;       // 重複防止用ハッシュ
}

export interface ParseResult {
    success: boolean;
    transactions: ParsedTransaction[];
    errors: string[];
    skippedRows: number;
}

/**
 * 銀行タイプに応じてCSVをパース
 */
export function parseBankCsv(
    buffer: Buffer,
    bankType: BankType,
    bankAccountId: string
): ParseResult {
    // エンコーディング検出 & デコード
    const content = decodeBuffer(buffer, bankType);
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    const result: ParseResult = {
        success: true,
        transactions: [],
        errors: [],
        skippedRows: 0,
    };

    try {
        switch (bankType) {
            case 'MUFG':
                return parseMufgCsv(lines, bankAccountId);
            case 'SMBC':
                return parseSmbcCsv(lines, bankAccountId);
            case 'YUCHO':
                return parseYuchoCsv(lines, bankAccountId);
            case 'RAKUTEN':
                return parseRakutenCsv(lines, bankAccountId);
            case 'MIZUHO':
                return parseMizuhoCsv(lines, bankAccountId);
            case 'PAYPAY':
                return parsePaypayCsv(lines, bankAccountId);
            case 'GMO_AOZORA':
                return parseGmoAozoraCsv(lines, bankAccountId);
            case 'OTHER':
            default:
                return parseGenericCsv(lines, bankAccountId);
        }
    } catch (error) {
        result.success = false;
        result.errors.push(`パースエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
        return result;
    }
}

/**
 * バッファをデコード（Shift-JIS or UTF-8）
 */
function decodeBuffer(buffer: Buffer, bankType: BankType): string {
    // 楽天銀行のみUTF-8、他（GMOあおぞら含む）はShift-JIS
    const utf8Banks: BankType[] = ['RAKUTEN'];
    const encoding = utf8Banks.includes(bankType) ? 'utf-8' : 'Shift_JIS';

    try {
        return iconv.decode(buffer, encoding);
    } catch {
        // フォールバック
        return iconv.decode(buffer, 'utf-8');
    }
}

/**
 * 日付を YYYY-MM-DD 形式に変換
 */
function normalizeDate(dateStr: string): string | null {
    // YYYY/MM/DD or YYYY-MM-DD
    let match = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }

    // YYYYMMDD
    match = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // 和暦対応（R5.11.01 → 2023-11-01）
    match = dateStr.match(/^[RH](\d{1,2})\.(\d{1,2})\.(\d{1,2})$/);
    if (match) {
        const era = dateStr.startsWith('R') ? 2018 : 1988; // 令和 or 平成
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
    // カンマ、円、スペースを除去
    const cleaned = amountStr.replace(/[,円\s]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * 重複防止用ハッシュを生成
 */
function generateHash(bankAccountId: string, date: string, description: string, withdrawal: number, deposit: number): string {
    const data = `${bankAccountId}|${date}|${description}|${withdrawal}|${deposit}`;
    return crypto.createHash('md5').update(data).digest('hex');
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

// ============================================
// 各銀行のパーサー実装
// ============================================

/**
 * 三菱UFJ銀行
 * 形式: 取引日,摘要,お支払金額,お預り金額,差引残高
 */
function parseMufgCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    // ヘッダー行を探してスキップ
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('取引日') && lines[i].includes('摘要')) {
            dataStartIndex = i + 1;
            break;
        }
    }

    for (let i = dataStartIndex; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 5) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[0]);
        if (!date) {
            result.skippedRows++;
            continue;
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: cols[1] || '',
            withdrawal: parseAmount(cols[2]),
            deposit: parseAmount(cols[3]),
            balance: cols[4] ? parseAmount(cols[4]) : null,
            import_hash: '',
        };
        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }

    return result;
}

/**
 * 三井住友銀行
 * 形式: お取引日,お取引内容,お引出し金額,お預入れ金額,残高
 */
function parseSmbcCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('お取引日') || lines[i].includes('取引日')) {
            dataStartIndex = i + 1;
            break;
        }
    }

    for (let i = dataStartIndex; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[0]);
        if (!date) {
            result.skippedRows++;
            continue;
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: cols[1] || '',
            withdrawal: parseAmount(cols[2]),
            deposit: parseAmount(cols[3]),
            balance: cols.length > 4 ? parseAmount(cols[4]) : null,
            import_hash: '',
        };
        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }

    return result;
}

/**
 * ゆうちょ銀行
 * 形式: 取扱日,取扱内容,出金,入金,残高
 */
function parseYuchoCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('取扱日') || lines[i].includes('日付')) {
            dataStartIndex = i + 1;
            break;
        }
    }

    for (let i = dataStartIndex; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[0]);
        if (!date) {
            result.skippedRows++;
            continue;
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: cols[1] || '',
            withdrawal: parseAmount(cols[2]),
            deposit: parseAmount(cols[3]),
            balance: cols.length > 4 ? parseAmount(cols[4]) : null,
            import_hash: '',
        };
        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }

    return result;
}

/**
 * 楽天銀行
 * 形式: 取引日,入出金内容,支出額,収入額,残高
 */
function parseRakutenCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('取引日') && (lines[i].includes('入出金') || lines[i].includes('摘要'))) {
            dataStartIndex = i + 1;
            break;
        }
    }

    for (let i = dataStartIndex; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[0]);
        if (!date) {
            result.skippedRows++;
            continue;
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: cols[1] || '',
            withdrawal: parseAmount(cols[2]),
            deposit: parseAmount(cols[3]),
            balance: cols.length > 4 ? parseAmount(cols[4]) : null,
            import_hash: '',
        };
        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }

    return result;
}

/**
 * みずほ銀行
 * 形式: 日付,お取引内容,お支払い金額,お預かり金額,残高
 */
function parseMizuhoCsv(lines: string[], bankAccountId: string): ParseResult {
    // SMBCと同様のフォーマット
    return parseSmbcCsv(lines, bankAccountId);
}

/**
 * PayPay銀行
 * 形式: 取引日,摘要,出金額,入金額,残高
 */
function parsePaypayCsv(lines: string[], bankAccountId: string): ParseResult {
    // ゆうちょと同様のフォーマット
    return parseYuchoCsv(lines, bankAccountId);
}

/**
 * GMOあおぞらネット銀行
 * 形式: 取引日,摘要,入金金額,出金金額,残高
 * Shift-JISエンコーディング
 */
function parseGmoAozoraCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('取引日') || lines[i].includes('日付')) {
            dataStartIndex = i + 1;
            break;
        }
    }

    for (let i = dataStartIndex; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[0]);
        if (!date) {
            result.skippedRows++;
            continue;
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: cols[1] || '',
            deposit: parseAmount(cols[2]),      // 入金が先
            withdrawal: parseAmount(cols[3]),   // 出金が後
            balance: cols.length > 4 ? parseAmount(cols[4]) : null,
            import_hash: '',
        };
        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }

    return result;
}

/**
 * 汎用パーサー（その他の銀行用）
 * 日付, 摘要, 出金, 入金, 残高 の順を想定
 */
function parseGenericCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    // 最初の行をヘッダーとしてスキップ
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 3) {
            result.skippedRows++;
            continue;
        }

        // 日付らしいカラムを探す
        let dateCol = -1;
        for (let j = 0; j < cols.length && j < 3; j++) {
            if (normalizeDate(cols[j])) {
                dateCol = j;
                break;
            }
        }

        if (dateCol === -1) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[dateCol])!;

        // 摘要は日付の次のカラム
        const descCol = dateCol + 1;
        const description = cols[descCol] || '';

        // 金額カラムを推測
        let withdrawal = 0;
        let deposit = 0;
        let balance: number | null = null;

        for (let j = descCol + 1; j < cols.length; j++) {
            const amount = parseAmount(cols[j]);
            if (amount > 0) {
                if (withdrawal === 0) {
                    withdrawal = amount;
                } else if (deposit === 0) {
                    deposit = amount;
                } else if (balance === null) {
                    balance = amount;
                }
            }
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description,
            withdrawal,
            deposit,
            balance,
            import_hash: '',
        };
        transaction.import_hash = generateHash(bankAccountId, date, description, withdrawal, deposit);
        result.transactions.push(transaction);
    }

    return result;
}

/**
 * 銀行タイプの表示名を取得
 */
export function getBankTypeName(bankType: BankType): string {
    const names: Record<BankType, string> = {
        MUFG: '三菱UFJ銀行',
        SMBC: '三井住友銀行',
        MIZUHO: 'みずほ銀行',
        YUCHO: 'ゆうちょ銀行',
        RAKUTEN: '楽天銀行',
        PAYPAY: 'PayPay銀行',
        GMO_AOZORA: 'GMOあおぞらネット銀行',
        OTHER: 'その他',
    };
    return names[bankType];
}
