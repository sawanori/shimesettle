import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parseBankCsv } from '@/lib/bankCsvParser';
import { BankType } from '@/types/supabase';

export async function POST(request: Request) {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const bankAccountId = formData.get('bankAccountId') as string;
        const bankType = formData.get('bankType') as BankType;

        if (!file || !bankAccountId || !bankType) {
            return NextResponse.json(
                { error: 'ファイル、口座ID、銀行タイプは必須です' },
                { status: 400 }
            );
        }

        // 口座の所有者チェック
        const { data: account } = await supabase
            .from('bank_accounts')
            .select('id')
            .eq('id', bankAccountId)
            .eq('user_id', user.id)
            .single();

        if (!account) {
            return NextResponse.json({ error: '口座が見つかりません' }, { status: 404 });
        }

        // ファイルをバッファに変換
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // CSVパース
        const parseResult = parseBankCsv(buffer, bankType, bankAccountId);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: parseResult.errors.join(', ') },
                { status: 400 }
            );
        }

        if (parseResult.transactions.length === 0) {
            return NextResponse.json(
                { error: '取引データが見つかりませんでした' },
                { status: 400 }
            );
        }

        // 既存のハッシュを取得（重複チェック用）
        const hashes = parseResult.transactions.map(t => t.import_hash);
        const { data: existingTx } = await supabase
            .from('bank_transactions')
            .select('import_hash')
            .eq('bank_account_id', bankAccountId)
            .in('import_hash', hashes);

        const existingHashes = new Set(existingTx?.map(t => t.import_hash) || []);

        // 新規取引のみをフィルタ
        const newTransactions = parseResult.transactions.filter(
            t => !existingHashes.has(t.import_hash)
        );

        if (newTransactions.length === 0) {
            return NextResponse.json({
                success: true,
                message: '全ての取引は既にインポート済みです',
                imported: 0,
                skipped: parseResult.transactions.length,
                duplicates: parseResult.transactions.length,
            });
        }

        // データベースに挿入
        const insertData = newTransactions.map(t => ({
            bank_account_id: bankAccountId,
            transaction_date: t.transaction_date,
            description: t.description,
            withdrawal: t.withdrawal,
            deposit: t.deposit,
            balance: t.balance,
            import_hash: t.import_hash,
            processing_date: t.processing_date,
            foreign_currency_amount: t.foreign_currency_amount,
            exchange_rate: t.exchange_rate,
            user_id: user.id,
        }));

        const { error: insertError } = await supabase
            .from('bank_transactions')
            .insert(insertData);

        if (insertError) {
            return NextResponse.json(
                { error: `インポートエラー: ${insertError.message}` },
                { status: 500 }
            );
        }

        // 原本CSVをStorageに保存
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = `${user.id}/${bankAccountId}/${timestamp}_${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from('bank-csv')
            .upload(filePath, buffer, {
                contentType: 'text/csv',
                upsert: false,
            });

        if (!uploadError) {
            // インポート履歴を記録
            await supabase.from('csv_imports').insert({
                bank_account_id: bankAccountId,
                file_path: filePath,
                file_name: file.name,
                records_count: newTransactions.length,
                user_id: user.id,
            });
        }

        return NextResponse.json({
            success: true,
            message: `${newTransactions.length}件の取引をインポートしました`,
            imported: newTransactions.length,
            skipped: parseResult.skippedRows,
            duplicates: parseResult.transactions.length - newTransactions.length,
        });
    } catch (error) {
        console.error('CSV import error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'インポートに失敗しました' },
            { status: 500 }
        );
    }
}
