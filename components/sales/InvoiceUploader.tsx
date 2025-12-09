'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, X, FileText } from 'lucide-react';
import { FileUploader } from '@/components/ui/file-uploader';

interface InvoiceUploaderProps {
    onUploadComplete: (url: string) => void;
}

export function InvoiceUploader({ onUploadComplete }: InvoiceUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        try {
            const supabase = createClient();
            const fileExt = file.name.split('.').pop();
            const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = uniqueName;

            const { error: uploadError } = await supabase.storage
                .from('receipts') // Changed to 'receipts' as per previous fix
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(filePath);

            onUploadComplete(publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert('アップロードに失敗しました');
        } finally {
            setIsUploading(false);
        }
    };

    const processFile = useCallback(async (file: File) => {
        setFileName(file.name);

        // 画像の場合はプレビュー表示
        if (file.type.startsWith('image/')) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        } else {
            setPreviewUrl(null);
        }

        await uploadFile(file);
    }, []);

    const handleFilesSelected = async (files: File[]) => {
        if (files.length > 0) {
            await processFile(files[0]);
        }
    };

    const clearFile = () => {
        setPreviewUrl(null);
        setFileName(null);
    };

    return (
        <div className="grid w-full items-center gap-1.5">
            <Label>請求書ファイル（任意）</Label>

            {!fileName ? (
                <FileUploader
                    onFilesSelected={handleFilesSelected}
                    maxFiles={1}
                    accept={['image/*', '.pdf']}
                    disabled={isUploading}
                    className="h-32"
                />
            ) : (
                <div className="relative w-full rounded-lg overflow-hidden border p-4 bg-background">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-32 object-contain" />
                    ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-8 w-8" />
                            <span className="text-sm truncate">{fileName}</span>
                        </div>
                    )}
                    <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={clearFile}
                        type="button"
                        disabled={isUploading}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                    {isUploading && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
