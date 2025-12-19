import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFiscalYearRange } from '@/lib/fiscalYear';
import type { Department, SalesChannel, AccountCategory } from '@/types/supabase';

export async function GET(request: Request) {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'expenses';
    const fiscalYearParam = searchParams.get('fiscalYear');
    const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam) : null;
    const department = searchParams.get('department') as Department | null;
    const channel = searchParams.get('channel') as SalesChannel | null;
    const accountCategory = searchParams.get('accountCategory') as AccountCategory | null;
    const bankAccountId = searchParams.get('bankAccountId');

    let data: any[] = [];
    let filename = '';

    // 会計年度の範囲を取得（11月〜翌年10月）
    const fiscalRange = fiscalYear ? getFiscalYearRange(fiscalYear) : null;

    if (type === 'sales') {
        let query = supabase.from('sales').select('*').order('transaction_date', { ascending: false });
        if (fiscalRange) {
            query = query.gte('transaction_date', fiscalRange.start).lte('transaction_date', fiscalRange.end);
        }
        if (department) {
            query = query.eq('department', department);
        }
        if (channel) {
            query = query.eq('channel', channel);
        }
        const { data: salesData, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        data = salesData || [];
        filename = `sales_${fiscalYear ? `${fiscalYear}年度` : 'all'}.csv`;
    } else if (type === 'bank_accounts') {
        // 銀行口座エクスポート
        let query = supabase.from('bank_accounts').select('*').eq('is_active', true).order('created_at', { ascending: false });
        if (accountCategory) {
            query = query.eq('category', accountCategory);
        }
        const { data: accountsData, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        data = accountsData || [];
        const categoryLabel = accountCategory ? `_${accountCategory === 'BUSINESS' ? 'ビジネス' : '個人'}` : '';
        filename = `bank_accounts${categoryLabel}.csv`;
    } else if (type === 'bank_transactions') {
        // 銀行取引エクスポート
        // まず口座を取得してカテゴリでフィルタリング
        let accountsQuery = supabase.from('bank_accounts').select('id, name, category');
        if (accountCategory) {
            accountsQuery = accountsQuery.eq('category', accountCategory);
        }
        const { data: accounts, error: accountsError } = await accountsQuery;
        if (accountsError) return NextResponse.json({ error: accountsError.message }, { status: 500 });

        const accountIds = accounts?.map(a => a.id) || [];
        const accountMap = new Map(accounts?.map(a => [a.id, a.name]) || []);

        if (accountIds.length === 0) {
            data = [];
        } else {
            let query = supabase.from('bank_transactions').select('*').in('bank_account_id', accountIds).order('transaction_date', { ascending: false });
            if (fiscalRange) {
                query = query.gte('transaction_date', fiscalRange.start).lte('transaction_date', fiscalRange.end);
            }
            if (bankAccountId) {
                query = query.eq('bank_account_id', bankAccountId);
            }
            const { data: transactionsData, error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            // 口座名を追加
            data = (transactionsData || []).map(t => ({
                ...t,
                account_name: accountMap.get(t.bank_account_id) || '不明',
            }));
        }
        const categoryLabel = accountCategory ? `_${accountCategory === 'BUSINESS' ? 'ビジネス' : '個人'}` : '';
        filename = `bank_transactions${categoryLabel}_${fiscalYear ? `${fiscalYear}年度` : 'all'}.csv`;
    } else {
        let query = supabase.from('expenses').select('*').order('transaction_date', { ascending: false });
        if (fiscalRange) {
            query = query.gte('transaction_date', fiscalRange.start).lte('transaction_date', fiscalRange.end);
        }
        if (department) {
            query = query.eq('department', department);
        }
        const { data: expensesData, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        data = expensesData || [];
        filename = `expenses_${fiscalYear ? `${fiscalYear}年度` : 'all'}.csv`;
    }

    // チャネルラベルマッピング
    const channelLabels: Record<string, string> = {
        DIRECT: '直接',
        REFERRAL: '紹介',
        SNS: 'SNS',
        WEBSITE: 'ウェブサイト',
        PLATFORM_KURASHI: 'くらしのマーケット',
        PLATFORM_TOTTA: 'Totta',
        REPEAT: 'リピート',
        OTHER: 'その他',
    };

    // カテゴリラベルマッピング
    const categoryLabels: Record<string, string> = {
        BUSINESS: 'ビジネス',
        PERSONAL: '個人',
    };

    // 銀行種別ラベルマッピング
    const bankTypeLabels: Record<string, string> = {
        MUFG: '三菱UFJ銀行',
        SMBC: '三井住友銀行',
        MIZUHO: 'みずほ銀行',
        YUCHO: 'ゆうちょ銀行',
        RAKUTEN: '楽天銀行',
        PAYPAY: 'PayPay銀行',
        GMO_AOZORA: 'GMOあおぞらネット銀行',
        OTHER: 'その他',
    };

    // Generate CSV Content
    let header = '';
    if (type === 'sales') {
        header = ['取引日', '金額', '手数料', '手数料率(%)', '手取り', '取引先', 'チャネル', '入金状況', '部門'].join(',') + '\r\n';
    } else if (type === 'bank_accounts') {
        header = ['口座名', 'カテゴリ', '銀行種別', '銀行名', '支店名', '口座番号', '開始残高'].join(',') + '\r\n';
    } else if (type === 'bank_transactions') {
        header = ['取引日', '口座名', '摘要', '入金', '出金', '残高'].join(',') + '\r\n';
    } else {
        header = ['取引日', '金額', '借方科目', '摘要', '部門'].join(',') + '\r\n';
    }

    const body = data.map(row => {
        if (type === 'sales') {
            const date = row.transaction_date;
            const amount = row.amount;
            const department = row.department;
            const feeAmount = row.fee_amount || 0;
            const feeRate = row.fee_rate || '';
            const netAmount = row.net_amount || amount;
            const clientName = sanitizeCsvField(row.client_name || '');
            const channel = channelLabels[row.channel] || row.channel || '';
            const status = row.status === 'PAID' ? '入金済' : '未入金';
            return [date, amount, feeAmount, feeRate, netAmount, clientName, channel, status, department].join(',');
        } else if (type === 'bank_accounts') {
            const name = sanitizeCsvField(row.name || '');
            const category = categoryLabels[row.category] || row.category || 'ビジネス';
            const bankType = bankTypeLabels[row.bank_type] || row.bank_type || '';
            const bankName = sanitizeCsvField(row.bank_name || '');
            const branchName = sanitizeCsvField(row.branch_name || '');
            const accountNumber = row.account_number || '';
            const initialBalance = row.initial_balance || 0;
            return [name, category, bankType, bankName, branchName, accountNumber, initialBalance].join(',');
        } else if (type === 'bank_transactions') {
            const date = row.transaction_date;
            const accountName = sanitizeCsvField(row.account_name || '');
            const description = sanitizeCsvField(row.description || '');
            const deposit = row.deposit || 0;
            const withdrawal = row.withdrawal || 0;
            const balance = row.balance !== null ? row.balance : '';
            return [date, accountName, description, deposit, withdrawal, balance].join(',');
        } else {
            const date = row.transaction_date;
            const amount = row.amount;
            const department = row.department;
            const accountItem = sanitizeCsvField(row.account_item || '');
            const description = sanitizeCsvField((row.description || '').replace(/,/g, ' '));
            return [date, amount, accountItem, description, department].join(',');
        }
    }).join('\r\n');

    const csvString = header + body;

    // UTF-8 BOM + CSV content
    // BOM (Byte Order Mark) を追加することで、WindowsのExcelでも正しく文字コードを認識
    const BOM = '\uFEFF';
    const csvWithBom = BOM + csvString;

    return new NextResponse(csvWithBom, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
    });
}

// CSVインジェクション対策
function sanitizeCsvField(field: string): string {
    // 先頭が =, +, -, @, \t, \r で始まる場合はシングルクォートでエスケープ
    if (/^[=+\-@\t\r]/.test(field)) {
        return `'${field}`;
    }
    // カンマ、ダブルクォート、改行を含む場合はダブルクォートで囲む
    if (/[",\n\r]/.test(field)) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
}
