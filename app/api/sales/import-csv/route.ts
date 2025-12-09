import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parseSalesCsv } from '@/lib/salesCsvParser';

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

        if (!file) {
            return NextResponse.json(
                { error: 'ファイルが必要です' },
                { status: 400 }
            );
        }

        // ファイルをバッファに変換
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // CSVパース
        const parseResult = parseSalesCsv(buffer);

        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: 'CSVのパースに失敗しました',
                    details: parseResult.errors,
                },
                { status: 400 }
            );
        }

        if (parseResult.sales.length === 0) {
            return NextResponse.json(
                { error: '有効なデータが見つかりませんでした' },
                { status: 400 }
            );
        }

        // データベースに挿入（手取り金額を計算）
        const insertData = parseResult.sales.map(sale => {
            // くらしのマーケットは20%手数料
            const netAmount = sale.channel === 'PLATFORM_KURASHI'
                ? Math.round(sale.amount * 0.8)
                : sale.amount;

            return {
                transaction_date: sale.transaction_date,
                amount: sale.amount,
                net_amount: netAmount,
                department: sale.department,
                client_name: sale.client_name,
                channel: sale.channel,
                status: sale.status,
                user_id: user.id,
            };
        });

        const { error: insertError } = await supabase
            .from('sales')
            .insert(insertData);

        if (insertError) {
            return NextResponse.json(
                { error: `インポートエラー: ${insertError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `${parseResult.sales.length}件の売上をインポートしました`,
            imported: parseResult.sales.length,
            skipped: parseResult.skippedRows,
            errors: parseResult.errors.length > 0 ? parseResult.errors : undefined,
        });
    } catch (error) {
        console.error('Sales CSV import error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'インポートに失敗しました' },
            { status: 500 }
        );
    }
}
