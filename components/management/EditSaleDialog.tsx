'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, FileText, ExternalLink } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Sale } from '@/types/supabase';

const formSchema = z.object({
    transaction_date: z.string().min(1, '日付は必須です'),
    amount: z.coerce.number().min(1, '金額は0より大きい必要があります'),
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']),
    client_name: z.string().min(1, '取引先は必須です'),
    channel: z.enum(['DIRECT', 'REFERRAL', 'SNS', 'WEBSITE', 'PLATFORM_KURASHI', 'PLATFORM_TOTTA', 'REPEAT', 'OTHER']).nullable(),
    fee_amount: z.coerce.number().nullable(),
    fee_rate: z.coerce.number().nullable(),
    status: z.enum(['UNPAID', 'PAID']),
});

type FormValues = z.infer<typeof formSchema>;

interface EditSaleDialogProps {
    sale: Sale | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: (updatedSale: Sale) => void;
}

// Parse file_path which can be a single URL, JSON array, or relative path
const parseFilePaths = (filePath: string | null): string[] => {
    if (!filePath) return [];
    if (filePath.startsWith('[')) {
        try {
            const parsed = JSON.parse(filePath);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            // Not valid JSON
        }
    }
    return [filePath];
};

export function EditSaleDialog({ sale, open, onOpenChange, onUpdate }: EditSaleDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingFiles, setExistingFiles] = useState<string[]>([]);
    const [newFiles, setNewFiles] = useState<{ file: File; previewUrl: string | null }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const supabase = createClient();

    const getFileUrl = (filePath: string): string => {
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            return filePath;
        }
        const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
        return data?.publicUrl || filePath;
    };

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            transaction_date: '',
            amount: 0,
            department: 'COMMON',
            client_name: '',
            channel: null,
            fee_amount: null,
            fee_rate: null,
            status: 'UNPAID',
        },
    });

    useEffect(() => {
        if (sale && open) {
            form.reset({
                transaction_date: sale.transaction_date,
                amount: sale.amount,
                department: sale.department as 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON',
                client_name: sale.client_name,
                channel: sale.channel as any,
                fee_amount: sale.fee_amount,
                fee_rate: sale.fee_rate,
                status: sale.status as 'UNPAID' | 'PAID',
            });
            // Load existing files
            setExistingFiles(parseFilePaths(sale.file_path));
            setNewFiles([]);
        }
    }, [sale, open, form]);

    // File handling functions
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        await processFiles(Array.from(files));
    };

    const processFiles = async (files: File[]) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const validFiles = files.filter(f => validTypes.includes(f.type));

        if (validFiles.length !== files.length) {
            alert('一部のファイルは対応していない形式のためスキップされました。PDF, PNG, JPGのみ対応しています。');
        }

        const newFileEntries = validFiles.map(file => ({
            file,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        }));

        setNewFiles(prev => [...prev, ...newFileEntries]);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await processFiles(files);
        }
    }, []);

    const removeExistingFile = (index: number) => {
        setExistingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewFile = (index: number) => {
        setNewFiles(prev => {
            const file = prev[index];
            if (file.previewUrl) {
                URL.revokeObjectURL(file.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const uploadNewFiles = async (): Promise<string[]> => {
        const uploadedUrls: string[] = [];

        for (const { file } of newFiles) {
            const fileExt = file.name.split('.').pop();
            const uniqueName = `sales_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(uniqueName, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(uniqueName);

            uploadedUrls.push(publicUrl);
        }

        return uploadedUrls;
    };

    const watchAmount = form.watch('amount');
    const watchFeeRate = form.watch('fee_rate');

    // Auto-calculate fee_amount when fee_rate changes
    useEffect(() => {
        if (watchFeeRate && watchAmount) {
            const feeAmount = Math.round(watchAmount * (watchFeeRate / 100));
            form.setValue('fee_amount', feeAmount);
        }
    }, [watchFeeRate, watchAmount, form]);

    const onSubmit = async (values: FormValues) => {
        if (!sale) return;

        setIsSubmitting(true);
        setIsUploading(true);
        try {
            // Upload new files first
            const uploadedUrls = newFiles.length > 0 ? await uploadNewFiles() : [];

            // Combine existing and new file URLs
            const allFiles = [...existingFiles, ...uploadedUrls];
            const filePath = allFiles.length === 0
                ? null
                : allFiles.length === 1
                    ? allFiles[0]
                    : JSON.stringify(allFiles);

            // Calculate net_amount
            const netAmount = values.fee_amount
                ? values.amount - values.fee_amount
                : values.amount;

            const { data, error } = await supabase
                .from('sales')
                .update({
                    transaction_date: values.transaction_date,
                    amount: values.amount,
                    department: values.department,
                    client_name: values.client_name,
                    channel: values.channel,
                    fee_amount: values.fee_amount,
                    fee_rate: values.fee_rate,
                    net_amount: netAmount,
                    status: values.status,
                    file_path: filePath,
                })
                .eq('id', sale.id)
                .select()
                .single();

            if (error) throw error;

            onUpdate(data);
            onOpenChange(false);
        } catch (error) {
            console.error('Update error:', error);
            alert('更新に失敗しました');
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>売上を編集</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="transaction_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>取引日</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>金額</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-muted-foreground">¥</span>
                                                <Input type="number" {...field} className="pl-7" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="department"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>事業区分</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="事業区分を選択" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PHOTO">写真事業</SelectItem>
                                                <SelectItem value="VIDEO">動画事業</SelectItem>
                                                <SelectItem value="WEB">WEB制作</SelectItem>
                                                <SelectItem value="COMMON">共通経費</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="client_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>取引先</FormLabel>
                                        <FormControl>
                                            <Input placeholder="取引先名" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="channel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>チャネル</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(val === 'NONE' ? null : val)}
                                            value={field.value || 'NONE'}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="チャネルを選択" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="NONE">未設定</SelectItem>
                                                <SelectItem value="DIRECT">直接営業</SelectItem>
                                                <SelectItem value="REFERRAL">紹介</SelectItem>
                                                <SelectItem value="SNS">SNS</SelectItem>
                                                <SelectItem value="WEBSITE">ウェブサイト</SelectItem>
                                                <SelectItem value="PLATFORM_KURASHI">くらしのマーケット</SelectItem>
                                                <SelectItem value="PLATFORM_TOTTA">Totta</SelectItem>
                                                <SelectItem value="REPEAT">リピート</SelectItem>
                                                <SelectItem value="OTHER">その他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>入金ステータス</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="UNPAID">未入金</SelectItem>
                                                <SelectItem value="PAID">入金済</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="fee_rate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>手数料率 (%)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                placeholder="例: 10"
                                                {...field}
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="fee_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>手数料額</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-muted-foreground">¥</span>
                                                <Input
                                                    type="number"
                                                    className="pl-7"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* File Attachment Section */}
                        <div className="space-y-2">
                            <Label>請求書・領収書（任意）</Label>

                            {/* Existing Files */}
                            {existingFiles.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500">添付済みファイル</p>
                                    <div className="flex flex-wrap gap-2">
                                        {existingFiles.map((file, index) => (
                                            <div
                                                key={index}
                                                className="relative group flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded px-3 py-2"
                                            >
                                                <FileText className="h-4 w-4 text-gray-500" />
                                                <a
                                                    href={getFileUrl(file)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline max-w-[150px] truncate"
                                                >
                                                    ファイル {index + 1}
                                                </a>
                                                <ExternalLink className="h-3 w-3 text-gray-400" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeExistingFile(index)}
                                                    className="ml-1 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                                >
                                                    <X className="h-3 w-3 text-red-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New Files to Upload */}
                            {newFiles.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500">追加するファイル</p>
                                    <div className="flex flex-wrap gap-2">
                                        {newFiles.map((item, index) => (
                                            <div
                                                key={index}
                                                className="relative flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-2"
                                            >
                                                {item.previewUrl ? (
                                                    <img
                                                        src={item.previewUrl}
                                                        alt="Preview"
                                                        className="h-8 w-8 object-cover rounded"
                                                    />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-blue-500" />
                                                )}
                                                <span className="text-sm max-w-[120px] truncate">
                                                    {item.file.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeNewFile(index)}
                                                    className="ml-1 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                                >
                                                    <X className="h-3 w-3 text-red-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Upload Area */}
                            <label
                                htmlFor="sale-file-upload"
                                className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                                    ${isDragOver
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-300 dark:border-gray-600 bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="flex flex-col items-center justify-center py-4">
                                    <Upload className={`w-5 h-5 mb-1 ${isDragOver ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        <span className="font-semibold">クリック</span> または <span className="font-semibold">ドラッグ＆ドロップ</span>
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        PDF, PNG, JPG（複数可）
                                    </p>
                                </div>
                                <Input
                                    id="sale-file-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    multiple
                                    onChange={handleFileChange}
                                    disabled={isUploading}
                                />
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                キャンセル
                            </Button>
                            <Button type="submit" disabled={isSubmitting || isUploading}>
                                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isUploading ? 'アップロード中...' : '保存'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
