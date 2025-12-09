'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentUploader } from './DocumentUploader';
import { Loader2 } from 'lucide-react';

const documentSchema = z.object({
    title: z.string().min(1, 'タイトルを入力してください'),
    document_type: z.string().min(1, '書類種別を選択してください'),
    description: z.string().optional(),
    issue_date: z.string().optional(),
    expiry_date: z.string().optional(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

const DOCUMENT_TYPES = [
    { value: 'certificate', label: '証明書' },
    { value: 'license', label: '許可証・免許証' },
    { value: 'registration', label: '登記書類' },
    { value: 'contract', label: '契約書' },
    { value: 'insurance', label: '保険証書' },
    { value: 'tax', label: '税務書類' },
    { value: 'financial', label: '財務書類' },
    { value: 'other', label: 'その他' },
];

interface DocumentFormProps {
    onSuccess?: () => void;
}

export function DocumentForm({ onSuccess }: DocumentFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<DocumentFormData>({
        resolver: zodResolver(documentSchema),
        defaultValues: {
            title: '',
            document_type: '',
            description: '',
            issue_date: '',
            expiry_date: '',
        },
    });

    const handleUploadComplete = (url: string, fileName: string, fileType: string) => {
        setUploadedFile({ url, name: fileName, type: fileType });
    };

    const onSubmit = async (data: DocumentFormData) => {
        if (!uploadedFile) {
            alert('ファイルをアップロードしてください');
            return;
        }

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data: userData } = await supabase.auth.getUser();

            if (!userData.user) {
                alert('ログインが必要です');
                return;
            }

            const { error } = await supabase.from('documents').insert({
                title: data.title,
                document_type: data.document_type,
                description: data.description || null,
                issue_date: data.issue_date || null,
                expiry_date: data.expiry_date || null,
                file_path: uploadedFile.url,
                file_name: uploadedFile.name,
                file_type: uploadedFile.type,
                user_id: userData.user.id,
            });

            if (error) {
                throw error;
            }

            alert('書類を登録しました');
            reset();
            setUploadedFile(null);
            onSuccess?.();
        } catch (error) {
            console.error('Error saving document:', error);
            alert('登録に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>書類登録</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <DocumentUploader onUploadComplete={handleUploadComplete} />
                    {uploadedFile && (
                        <p className="text-sm text-green-600">
                            アップロード完了: {uploadedFile.name}
                        </p>
                    )}

                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="title">タイトル *</Label>
                        <Input
                            id="title"
                            placeholder="例: 開業届受理証明"
                            {...register('title')}
                        />
                        {errors.title && (
                            <p className="text-sm text-red-500">{errors.title.message}</p>
                        )}
                    </div>

                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="document_type">書類種別 *</Label>
                        <Select
                            onValueChange={(value) => setValue('document_type', value)}
                            value={watch('document_type')}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent>
                                {DOCUMENT_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.document_type && (
                            <p className="text-sm text-red-500">{errors.document_type.message}</p>
                        )}
                    </div>

                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="description">説明・メモ</Label>
                        <Textarea
                            id="description"
                            placeholder="書類の内容や備考など"
                            {...register('description')}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="issue_date">発行日</Label>
                            <Input
                                id="issue_date"
                                type="date"
                                {...register('issue_date')}
                            />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="expiry_date">有効期限</Label>
                            <Input
                                id="expiry_date"
                                type="date"
                                {...register('expiry_date')}
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting || !uploadedFile}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                登録中...
                            </>
                        ) : (
                            '登録'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
