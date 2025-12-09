import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('id');

    if (!importId) {
        return NextResponse.json({ error: 'インポートIDは必須です' }, { status: 400 });
    }

    // インポート記録を取得（所有者チェック含む）
    const { data: importRecord, error: fetchError } = await supabase
        .from('csv_imports')
        .select('*')
        .eq('id', importId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !importRecord) {
        return NextResponse.json({ error: 'インポート記録が見つかりません' }, { status: 404 });
    }

    // Storageからファイルをダウンロード
    const { data: fileData, error: downloadError } = await supabase.storage
        .from('bank-csv')
        .download(importRecord.file_path);

    if (downloadError || !fileData) {
        return NextResponse.json({ error: 'ファイルのダウンロードに失敗しました' }, { status: 500 });
    }

    // ファイルを返す
    const arrayBuffer = await fileData.arrayBuffer();

    return new NextResponse(arrayBuffer, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(importRecord.file_name)}"`,
        },
    });
}
