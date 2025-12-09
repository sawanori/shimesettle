import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAllowedUrl, checkRateLimit } from '@/lib/api-security';
import { extractTextFromPdf, isPdfUrl } from '@/lib/pdf-utils';
import { InvoiceSchema } from '@/lib/schemas';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        // 認証チェック
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // レート制限チェック
        if (!checkRateLimit(user.id)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please wait before trying again.' },
                { status: 429 }
            );
        }

        const { imageUrl } = await req.json();

        if (!imageUrl) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        // SSRF対策: URLを検証
        if (!isAllowedUrl(imageUrl)) {
            return NextResponse.json(
                { error: 'Invalid image URL. Only images from Supabase Storage are allowed.' },
                { status: 400 }
            );
        }

        let userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

        // PDFか画像かで処理を分岐
        if (isPdfUrl(imageUrl)) {
            try {
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error('Failed to fetch PDF');
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const pdfText = await extractTextFromPdf(buffer);

                userContent = [
                    { type: 'text', text: 'Analyze this invoice text extracted from a PDF:' },
                    { type: 'text', text: pdfText }
                ];
            } catch (e) {
                console.error('PDF parsing error', e);
                return NextResponse.json(
                    { error: 'Failed to parse PDF file.' },
                    { status: 500 }
                );
            }
        } else {
            userContent = [
                { type: 'text', text: 'Analyze this invoice.' },
                {
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                    },
                },
            ];
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert accountant assistant. Analyze the invoice and extract the following information in JSON format:
          - transaction_date: Date of invoice (YYYY-MM-DD). If the year is missing, assume the current year.
          - amount: Total amount including tax (number only).
          - client_name: The name of the client being billed (Bill To / 請求先). Do NOT extract the issuer's name.
          - department: Infer the department (PHOTO, VIDEO, WEB, COMMON) based on the service description.
            - Photography/Camera -> PHOTO
            - Video editing/Shooting -> VIDEO
            - Web design/Coding/Server -> WEB
            - Others -> COMMON
          - description: Brief summary of the service provided.

          If a field cannot be determined, make a reasonable guess or use null.`,
                },
                {
                    role: 'user',
                    content: userContent as any,
                },
            ],
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error('No content received from OpenAI');
        }

        const data = JSON.parse(content);
        const validatedData = InvoiceSchema.parse(data);

        return NextResponse.json(validatedData);
    } catch (error) {
        console.error('OCR Error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze invoice' },
            { status: 500 }
        );
    }
}
