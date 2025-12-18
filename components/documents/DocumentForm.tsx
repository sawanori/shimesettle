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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentUploader } from './DocumentUploader';
import { BatchDocumentUploader } from './BatchDocumentUploader';
import { Loader2, CheckCircle2, FileText, Upload } from 'lucide-react';

const documentSchema = z.object({
    title: z.string().min(1, 'タイトルを入力してください'),
    document_type: z.string().min(1, '書類種別を選択してください'),
    description: z.string().optional(),
    issue_date: z.string().optional(),
    expiry_date: z.string().optional(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

const DOCUMENT_TYPES = [
    { value: '証明書', label: '証明書' },
    { value: '許可証', label: '許可証・免許証' },
    { value: '契約書', label: '契約書' },
    { value: '届出書', label: '届出書' },
    { value: 'その他', label: 'その他' },
];

interface DocumentFormProps {
    onSuccess?: () => void;
}

// 一括アップロード用の状態
interface BatchUploadItem {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'uploaded' | 'error';
    filePath?: string;
    fileName: string;
    fileType: string;
    error?: string;
}

export function DocumentForm({ onSuccess }: DocumentFormProps) {
    const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

    // ============ Single Form State ============
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);

    // ============ Batch Form State ============
    const [batchFiles, setBatchFiles] = useState<File[]>([]);
    const [batchItems, setBatchItems] = useState<BatchUploadItem[]>([]);
    const [batchDocumentType, setBatchDocumentType] = useState<string>('その他');
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState(0);
    const [batchComplete, setBatchComplete] = useState(false);

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

    // ============ Single Submit ============
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

    // ============ Batch Handlers ============
    const handleBatchFilesSelected = (files: File[]) => {
        setBatchFiles(files);
        setBatchComplete(false);
    };

    const handleBatchUpload = async () => {
        if (batchFiles.length === 0) {
            alert('ファイルを選択してください');
            return;
        }

        setIsBatchProcessing(true);
        setBatchProgress(0);
        setBatchComplete(false);

        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
            alert('ログインが必要です');
            setIsBatchProcessing(false);
            return;
        }

        const items: BatchUploadItem[] = batchFiles.map(file => ({
            id: Math.random().toString(36).substring(2),
            file,
            status: 'pending' as const,
            fileName: file.name,
            fileType: file.type,
        }));

        setBatchItems(items);

        let successCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Update status to uploading
            setBatchItems(prev => prev.map(it =>
                it.id === item.id ? { ...it, status: 'uploading' as const } : it
            ));

            try {
                // Upload file to storage
                const fileExt = item.file.name.split('.').pop();
                const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(uniqueName, item.file);

                if (uploadError) {
                    throw uploadError;
                }

                // Get file path (not public URL since bucket is private)
                const filePath = uniqueName;

                // Insert document record
                const title = item.file.name.replace(/\.[^/.]+$/, ''); // Remove extension for title

                const { error: insertError } = await supabase.from('documents').insert({
                    title: title,
                    document_type: batchDocumentType,
                    description: null,
                    issue_date: null,
                    expiry_date: null,
                    file_path: filePath,
                    file_name: item.file.name,
                    file_type: item.file.type,
                    user_id: userData.user.id,
                });

                if (insertError) {
                    throw insertError;
                }

                // Update status to uploaded
                setBatchItems(prev => prev.map(it =>
                    it.id === item.id ? { ...it, status: 'uploaded' as const, filePath } : it
                ));

                successCount++;

            } catch (error) {
                console.error('Batch upload error:', error);
                setBatchItems(prev => prev.map(it =>
                    it.id === item.id ? { ...it, status: 'error' as const, error: 'アップロード失敗' } : it
                ));
            }

            // Update progress
            setBatchProgress(Math.round(((i + 1) / items.length) * 100));
        }

        setIsBatchProcessing(false);
        setBatchComplete(true);

        if (successCount > 0) {
            alert(`${successCount}件の書類を登録しました`);
            onSuccess?.();
        }

        if (successCount === items.length) {
            // All succeeded, clear the form
            setBatchFiles([]);
            setBatchItems([]);
            setBatchProgress(0);
        }
    };

    const resetBatch = () => {
        setBatchFiles([]);
        setBatchItems([]);
        setBatchProgress(0);
        setBatchComplete(false);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>書類登録</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'batch')}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="single" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            1件登録
                        </TabsTrigger>
                        <TabsTrigger value="batch" className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            一括登録
                        </TabsTrigger>
                    </TabsList>

                    {/* Single Upload Tab */}
                    <TabsContent value="single" forceMount className={activeTab !== 'single' ? 'hidden' : ''}>
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
                    </TabsContent>

                    {/* Batch Upload Tab */}
                    <TabsContent value="batch" forceMount className={activeTab !== 'batch' ? 'hidden' : ''}>
                        <div className="space-y-4">
                            {!batchComplete ? (
                                <>
                                    <BatchDocumentUploader
                                        onFilesSelected={handleBatchFilesSelected}
                                        disabled={isBatchProcessing}
                                    />

                                    <div className="grid w-full items-center gap-1.5">
                                        <Label>書類種別（一括設定）</Label>
                                        <Select
                                            value={batchDocumentType}
                                            onValueChange={setBatchDocumentType}
                                            disabled={isBatchProcessing}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DOCUMENT_TYPES.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            全ファイルに同じ種別が設定されます。タイトルはファイル名から自動設定されます。
                                        </p>
                                    </div>

                                    {isBatchProcessing && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>アップロード中...</span>
                                                <span>{batchProgress}%</span>
                                            </div>
                                            <Progress value={batchProgress} />
                                        </div>
                                    )}

                                    {batchItems.length > 0 && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {batchItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={`flex items-center justify-between p-2 rounded text-sm ${
                                                        item.status === 'uploaded'
                                                            ? 'bg-green-50 dark:bg-green-900/20'
                                                            : item.status === 'error'
                                                            ? 'bg-red-50 dark:bg-red-900/20'
                                                            : item.status === 'uploading'
                                                            ? 'bg-blue-50 dark:bg-blue-900/20'
                                                            : 'bg-gray-50 dark:bg-gray-800'
                                                    }`}
                                                >
                                                    <span className="truncate flex-1">{item.fileName}</span>
                                                    <span className="ml-2">
                                                        {item.status === 'uploaded' && (
                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        )}
                                                        {item.status === 'uploading' && (
                                                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                        )}
                                                        {item.status === 'error' && (
                                                            <span className="text-red-500 text-xs">{item.error}</span>
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        type="button"
                                        className="w-full"
                                        disabled={batchFiles.length === 0 || isBatchProcessing}
                                        onClick={handleBatchUpload}
                                    >
                                        {isBatchProcessing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                アップロード中...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="mr-2 h-4 w-4" />
                                                {batchFiles.length}件を一括登録
                                            </>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center space-y-4 py-8">
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                                    <p className="text-lg font-medium">登録完了</p>
                                    <p className="text-sm text-muted-foreground">
                                        {batchItems.filter(i => i.status === 'uploaded').length}件の書類を登録しました
                                    </p>
                                    <Button onClick={resetBatch} variant="outline">
                                        続けて登録する
                                    </Button>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
