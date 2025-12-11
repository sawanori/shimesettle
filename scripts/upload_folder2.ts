/**
 * フォルダ2の領収書を一括アップロード・登録するスクリプト
 *
 * 使用方法:
 * 1. 開発サーバーを起動: npm run dev
 * 2. ブラウザでログインしてセッションを取得
 * 3. このスクリプトを実行: npx tsx scripts/upload_folder2.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FOLDER_PATH = '/Users/noritakasawada/Downloads/receipt/2';

// Supabase service role keyが必要（RLSをバイパスするため）
// .env.localに SUPABASE_SERVICE_ROLE_KEY= を追加してください
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeReceipt(imageUrl: string, retries = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch('http://localhost:3000/api/analyze-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.log(`  Attempt ${attempt}/${retries} failed:`, error instanceof Error ? error.message : error);
            if (attempt < retries) {
                console.log(`  Retrying in 2 seconds...`);
                await sleep(2000);
            } else {
                throw error;
            }
        }
    }
}

async function main() {
    console.log('Starting upload process for folder 2...\n');

    if (!SERVICE_ROLE_KEY) {
        console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
        console.log('\nPlease add the following to your .env.local:');
        console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
        console.log('\nYou can find this key in your Supabase project settings > API > service_role key');
        process.exit(1);
    }

    // Use service role client to bypass RLS
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get user ID from regular client or hardcode it
    // First, let's list users to get a valid user_id
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError || !users?.users?.length) {
        console.error('Could not get users:', usersError?.message);
        process.exit(1);
    }

    const userId = users.users[0].id;
    console.log(`Using user_id: ${userId}\n`);

    // Get all jpg files
    const files = fs.readdirSync(FOLDER_PATH)
        .filter(f => f.endsWith('.jpg') && !f.startsWith('.'))
        .sort();

    console.log(`Found ${files.length} files to process\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
        const fileName = files[i];
        const filePath = path.join(FOLDER_PATH, fileName);

        console.log(`[${i + 1}/${files.length}] Processing: ${fileName}`);

        try {
            // Read file
            const fileBuffer = fs.readFileSync(filePath);

            // Upload to Supabase Storage
            const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(uniqueName, fileBuffer, {
                    contentType: 'image/jpeg'
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(uniqueName);

            console.log(`  Uploaded: ${publicUrl.substring(0, 60)}...`);

            // Analyze with AI
            console.log(`  Analyzing with AI...`);
            const analysisResult = await analyzeReceipt(publicUrl);

            console.log(`  Result: ¥${analysisResult.amount?.toLocaleString() || 0} - ${analysisResult.account_item || 'N/A'}`);

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
                folder_number: '2',
                user_id: userId,
                status: 'UNCONFIRMED',
                ai_check_status: 'PENDING',
            };

            const { error: insertError } = await supabase
                .from('expenses')
                .insert(expenseData);

            if (insertError) {
                throw new Error(`Insert failed: ${insertError.message}`);
            }

            console.log(`  ✓ Registered successfully\n`);
            successCount++;

            // Wait between requests to avoid rate limiting
            if (i < files.length - 1) {
                await sleep(1000);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`  ✗ Error: ${errorMsg}\n`);
            errors.push(`${fileName}: ${errorMsg}`);
            errorCount++;
        }
    }

    console.log('\n========== Summary ==========');
    console.log(`Total files: ${files.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
        console.log('\nFailed files:');
        errors.forEach(e => console.log(`  - ${e}`));
    }
}

main().catch(console.error);
