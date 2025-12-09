'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, FileText } from 'lucide-react';

interface SingleReceiptUploaderProps {
    onUploadComplete: (url: string) => void;
}

export function SingleReceiptUploader({ onUploadComplete }: SingleReceiptUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
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

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        // ファイルタイプチェック
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('対応していないファイル形式です。PDF, PNG, JPGをアップロードしてください。');
            return;
        }

        await processFile(file);
    }, [processFile]);

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        try {
            const supabase = createClient();
            const fileExt = file.name.split('.').pop();
            const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = uniqueName;

            const { error: uploadError } = await supabase.storage
                .from('receipts')
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

    const clearFile = () => {
        setPreviewUrl(null);
        setFileName(null);
    };

    return (
        <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="receipt">領収書ファイル（任意）</Label>

            {!fileName ? (
                <div className="flex items-center justify-center w-full">
                    <label
                        htmlFor="dropzone-receipt"
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                            ${isDragOver
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600 bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700'
                            }`}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className={`w-6 h-6 mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-semibold">クリック</span> または <span className="font-semibold">ドラッグ＆ドロップ</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                PDF, PNG, JPG
                            </p>
                        </div>
                        <Input
                            id="dropzone-receipt"
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </label>
                </div>
            ) : (
                <div className="relative w-full rounded-lg overflow-hidden border p-4">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-32 object-contain" />
                    ) : (
                        <div className="flex items-center gap-2 text-gray-600">
                            <FileText className="h-8 w-8" />
                            <span className="text-sm truncate">{fileName}</span>
                        </div>
                    )}
                    <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={clearFile}
                        type="button"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
