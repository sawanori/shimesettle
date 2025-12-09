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
    deposit: number;           // 入金（返金など）
    balance: number | null;    // 残高（カードの場合は請求確定額など、無ければnull）
    import_hash: string;       // 重複防止用ハッシュ
    // クレジットカード用拡張
    processing_date?: string | null;      // データ処理日
    foreign_currency_amount?: number | null; // 海外通貨利用金額
    exchange_rate?: number | null;        // 換算レート
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
            case 'RAKUTEN_CARD':
                return parseRakutenCardCsv(lines, bankAccountId);
            case 'AMEX':
                return parseAmexCsv(lines, bankAccountId);
            case 'OTHER':
            case 'OTHER_CARD':
            default:
                if (bankType === 'OTHER_CARD') {
                    return parseGenericCardCsv(lines, bankAccountId);
                }
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
    // 楽天銀行・楽天カードのみUTF-8、他（GMOあおぞら、AMEX含む）はShift-JIS
    const utf8Banks: BankType[] = ['RAKUTEN', 'RAKUTEN_CARD'];
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
 * 楽天カード
 * 想定形式: 利用日,利用店名・商品名,利用者,支払方法,利用金額,手数料,支払総額
 * ※海外利用の場合、備考欄などにレートが含まれる場合があるが、標準CSVでは詳細がないことが多い。
 * ※ここでは標準的な明細CSVを想定。
 */
function parseRakutenCardCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('利用日') && lines[i].includes('利用店名')) {
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

        const date = normalizeDate(cols[0]); // 利用日
        if (!date) {
            result.skippedRows++;
            continue;
        }

        const description = cols[1] || ''; // 利用店名・商品名
        const amount = parseAmount(cols[4]); // 利用金額

        // 楽天カードCSVでは支払が正の数で来るため、withdrawalにセット
        // マイナスの場合はキャンセル/返金としてdepositにセット
        let withdrawal = 0;
        let deposit = 0;

        if (amount >= 0) {
            withdrawal = amount;
        } else {
            deposit = Math.abs(amount);
        }

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: description,
            withdrawal: withdrawal,
            deposit: deposit,
            balance: null,
            import_hash: '',
            // 楽天カード標準CSVには処理日やレート列は通常ないが、あれば拡張可能
            processing_date: null,
            foreign_currency_amount: null,
            exchange_rate: null
        };

        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }
    return result;
}

/**
 * アメリカン・エキスプレス
 * 想定形式: 日付,説明,金額,海外利用額,換算レート,処理日... (形式は可変なため、キーワード探索で実装)
 * アメックスCSVは "日付", "内容", "金額" 等が含まれる
 */
function parseAmexCsv(lines: string[], bankAccountId: string): ParseResult {
    // アメックスはGUIでダウンロードできるCSVがシンプルな場合が多いが、
    // ここでは一般的なカラム構成を探索するロジックにする。
    return parseGenericCardCsv(lines, bankAccountId);
}

/**
 * 汎用カードパーサー
 * 基本構成: 日付, 内容, 金額, (処理日), (外貨額), (レート)
 * TSV（タブ区切り）にも対応
 */
function parseGenericCardCsv(lines: string[], bankAccountId: string): ParseResult {
    const result: ParseResult = { success: true, transactions: [], errors: [], skippedRows: 0 };

    // 区切り文字を判定（最初の数行を見てタブが含まれていればTSVとみなす）
    // ただし、明らかなCSV（カンマが多い）ならCSV
    let separator = ',';
    const sampleLine = lines.find(l => l.includes('\t') || l.includes(','));
    if (sampleLine && sampleLine.includes('\t') && !sampleLine.includes(',')) {
        separator = '\t';
    } else if (sampleLine && sampleLine.includes('\t') && (sampleLine.match(/,/g)?.length || 0) < (sampleLine.match(/\t/g)?.length || 0)) {
        // タブの方が多い場合もTSVとする（Excelコピペなど）
        separator = '\t';
    }

    // ヘッダー行を探す
    let headerIndex = -1;
    let colMap: Record<string, number> = {};

    // 一般的なヘッダー名で列を特定
    // 一般的なヘッダー名で列を特定
    const keywords = {
        date: ['利用日', '日付', 'Date', 'ご利用日'],
        description: ['利用店名', '商品名', '摘要', '内容', 'Description', 'ご利用内容'],
        amount: ['利用金額', '金額', 'Amount'],
        processing_date: ['処理日', 'データ処理日', 'Process Date'],
        foreign_amount: ['現地利用額', '外貨金額', 'Foreign Amount', '海外通貨利用金額'],
        rate: ['換算レート', 'レート', 'Exchange Rate']
    };

    for (let i = 0; i < Math.min(20, lines.length); i++) {
        const cols = separator === '\t' ? lines[i].split('\t') : parseCsvLine(lines[i]);
        const headers = cols.map(c => c.trim());
        const map: Record<string, number> = {};
        let score = 0;

        // 各フィールドごとに列を探す（完全一致優先）
        const findCol = (fieldKeywords: string[]) => {
            // 完全一致
            let idx = headers.findIndex(h => fieldKeywords.some(k => h === k));
            if (idx !== -1) return idx;
            // 部分一致
            return headers.findIndex(h => fieldKeywords.some(k => h.includes(k)));
        };

        const dateIdx = findCol(keywords.date);
        if (dateIdx !== -1) { map.date = dateIdx; score++; }

        const amountIdx = findCol(keywords.amount);
        if (amountIdx !== -1) { map.amount = amountIdx; score++; }

        // 内容（Description）は誤判定しやすいので、日付や金額で使われた列は除外したいが、
        // findIndexは最初に見つかったものを返すので、重複する場合は後で調整が必要。
        // ここでは単純に探す。
        const descIdx = findCol(keywords.description);
        if (descIdx !== -1 && descIdx !== dateIdx && descIdx !== amountIdx) {
            map.description = descIdx;
            score++;
        } else if (descIdx !== -1) {
            // すでに取られている場合、別の候補を探す必要があるが、
            // 簡易的に「内容」は必須キーワードなので、もし被っていたら
            // ヘッダー行ではない可能性が高い（同じ列名が複数ある場合を除く）
        }

        const procDateIdx = findCol(keywords.processing_date);
        if (procDateIdx !== -1 && procDateIdx !== dateIdx) { map.processing_date = procDateIdx; } // processing_dateはscoreに加えない（必須ではない）

        const foreignAmountIdx = findCol(keywords.foreign_amount);
        if (foreignAmountIdx !== -1) { map.foreign_amount = foreignAmountIdx; }

        const rateIdx = findCol(keywords.rate);
        if (rateIdx !== -1) { map.rate = rateIdx; }

        if (score >= 2) { // 日付と金額（または内容）が見つかればヘッダーとみなす
            headerIndex = i;
            colMap = map;
            break;
        }
    }

    if (headerIndex === -1) {
        // ヘッダーが見つからない場合、汎用銀行CSVパーサーに委譲
        return parseGenericCsv(lines, bankAccountId);
    }

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const cols = separator === '\t' ? lines[i].split('\t') : parseCsvLine(lines[i]);
        if (cols.length <= Math.max(...Object.values(colMap))) {
            result.skippedRows++;
            continue;
        }

        if (colMap.date === undefined || !normalizeDate(cols[colMap.date])) {
            result.skippedRows++;
            continue;
        }

        const date = normalizeDate(cols[colMap.date])!;
        const description = (colMap.description !== undefined) ? cols[colMap.description] : '';

        let amountStr = (colMap.amount !== undefined) ? cols[colMap.amount] : '0';
        let amount = parseAmount(amountStr);

        // カード明細の場合、通常は正の値が請求（出金）
        // ただし、もしCSV内で貸方/借方が分かれている、あるいは符号で表現されている場合は調整が必要
        // ここでは「正＝利用（出金）」と仮定する。マイナスなら返金（入金）。
        // ※アメックスなどは返金がマイナスで表現されることが多い
        let withdrawal = 0;
        let deposit = 0;

        // 金額文字列にマイナスが含まれているかチェック (parseAmountは絶対値を返すため元の文字列を確認)
        if (amountStr.includes('-')) {
            deposit = amount; // マイナスは返金(入金)扱い
        } else {
            withdrawal = amount;
        }

        const processingDate = (colMap.processing_date !== undefined) ? normalizeDate(cols[colMap.processing_date]) : null;
        const foreignAmount = (colMap.foreign_amount !== undefined) ? parseAmount(cols[colMap.foreign_amount]) : null;
        const rate = (colMap.rate !== undefined) ? parseFloat(cols[colMap.rate].replace(/[^0-9.]/g, '')) : null;

        const transaction: ParsedTransaction = {
            transaction_date: date,
            description: description,
            withdrawal: withdrawal,
            deposit: deposit,
            balance: null,
            import_hash: '',
            processing_date: processingDate,
            foreign_currency_amount: foreignAmount,
            exchange_rate: isNaN(rate || NaN) ? null : rate
        };

        transaction.import_hash = generateHash(bankAccountId, date, transaction.description, transaction.withdrawal, transaction.deposit);
        result.transactions.push(transaction);
    }

    return result;
}

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
        RAKUTEN_CARD: '楽天カード',
        AMEX: 'アメリカン・エキスプレス',
        OTHER_CARD: 'その他カード',
    };
    return names[bankType];
}
