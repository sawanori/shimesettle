import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folderNumber = formData.get('folder_number') as string || '';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(uniqueName, buffer, {
                contentType: file.type
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(uniqueName);

        // Analyze with AI
        const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/analyze-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: publicUrl }),
        });

        if (!analyzeResponse.ok) {
            const errorText = await analyzeResponse.text();
            return NextResponse.json({ error: `AI analysis failed: ${errorText}` }, { status: 500 });
        }

        const analysisResult = await analyzeResponse.json();

        // Insert into expenses table
        const expenseData = {
            transaction_date: analysisResult.transaction_date || new Date().toISOString().split('T')[0],
            amount: analysisResult.amount || 0,
            department: analysisResult.department || 'COMMON',
            account_item: analysisResult.account_item || '',
            description: analysisResult.vendor_name
                ? `${analysisResult.vendor_name}${analysisResult.description ? ' / ' + analysisResult.description : ''}`
                : analysisResult.description || '',
            file_path: publicUrl,
            folder_number: folderNumber,
            user_id: user.id,
            status: 'UNCONFIRMED',
            ai_check_status: 'PENDING',
        };

        const { error: insertError } = await supabase
            .from('expenses')
            .insert(expenseData);

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            expense: expenseData,
            analysis: analysisResult
        });

    } catch (error) {
        console.error('Batch upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
