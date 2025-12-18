'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, FileText, Plus, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';

const MAX_FILES = 10;

interface SelectedFile {
    id: string;
    file: File;
    previewUrl: string | null;
}

interface BatchDocumentUploaderProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
}

export function BatchDocumentUploader({ onFilesSelected, disabled }: BatchDocumentUploaderProps) {
    const [files, setFiles] = useState<SelectedFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

    const notifyParent = useCallback((updatedFiles: SelectedFile[]) => {
        onFilesSelected(updatedFiles.map(f => f.file));
    }, [onFilesSelected]);

    const processFiles = useCallback((newFiles: File[]) => {
        const remainingSlots = MAX_FILES - files.length;

        if (remainingSlots <= 0) {
            alert(`最大${MAX_FILES}件までアップロードできます。`);
            return;
        }

        // ファイルタイプチェック
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/csv'];
        const validExtensions = ['.csv', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

        const validFiles = newFiles.filter(file => {
            const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
            return validTypes.includes(file.type) || validExtensions.includes(ext);
        });

        if (validFiles.length < newFiles.length) {
            alert(`${newFiles.length - validFiles.length}件の非対応ファイルがスキップされました`);
        }

        const filesToAdd = validFiles.slice(0, remainingSlots);

        if (validFiles.length > remainingSlots) {
            alert(`${validFiles.length - remainingSlots}件のファイルがスキップされました（最大${MAX_FILES}件）`);
        }

        const newSelectedFiles: SelectedFile[] = filesToAdd.map(file => {
            const id = Math.random().toString(36).substring(2);
            let previewUrl: string | null = null;

            if (file.type.startsWith('image/')) {
                previewUrl = URL.createObjectURL(file);
            }

            return { id, file, previewUrl };
        });

        const updated = [...files, ...newSelectedFiles];
        setFiles(updated);
        notifyParent(updated);
    }, [files, notifyParent]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;
        processFiles(Array.from(selectedFiles));
        e.target.value = '';
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

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const droppedFiles = e.dataTransfer.files;
        if (!droppedFiles || droppedFiles.length === 0) return;
        processFiles(Array.from(droppedFiles));
    }, [processFiles]);

    const removeFile = (fileId: string) => {
        const updated = files.filter(f => f.id !== fileId);
        setFiles(updated);
        notifyParent(updated);
    };

    const clearAll = () => {
        files.forEach(f => {
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        setFiles([]);
        notifyParent([]);
    };

    const canAddMore = files.length < MAX_FILES;

    return (
        <div className="grid w-full items-center gap-1.5">
            <div className="flex justify-between items-center">
                <Label>書類ファイル（最大{MAX_FILES}件）</Label>
                {files.length > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        disabled={disabled}
                        className="text-xs text-muted-foreground hover:text-destructive"
                    >
                        すべてクリア
                    </Button>
                )}
            </div>

            {/* File previews grid */}
            {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-2">
                    {files.map((item, index) => (
                        <div
                            key={item.id}
                            className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30"
                        >
                            {item.previewUrl ? (
                                <img
                                    src={item.previewUrl}
                                    alt={item.file.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-2">
                                    <FileText className="h-8 w-8 mb-1" />
                                    <span className="text-xs truncate w-full text-center">{item.file.name}</span>
                                </div>
                            )}
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                {index + 1}
                            </div>
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => removeFile(item.id)}
                                type="button"
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}

                    {/* Add more button */}
                    {canAddMore && !disabled && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center">
                            <Plus className="h-8 w-8 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1">追加</span>
                            <Input
                                type="file"
                                className="hidden"
                                accept="image/*,.pdf,.csv"
                                multiple
                                onChange={handleFileChange}
                                disabled={disabled}
                            />
                        </label>
                    )}
                </div>
            )}

            {/* Initial dropzone */}
            {files.length === 0 && (
                <label
                    className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors
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
                        <Upload className={`w-10 h-10 mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">クリック</span> または <span className="font-semibold">ドラッグ＆ドロップ</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            PDF, PNG, JPG, CSV（複数選択可）
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            最大{MAX_FILES}件まで
                        </p>
                    </div>
                    <Input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.csv"
                        multiple
                        onChange={handleFileChange}
                        disabled={disabled}
                    />
                </label>
            )}

            {files.length > 0 && (
                <p className="text-sm text-muted-foreground">
                    {files.length}件のファイルが選択されています
                </p>
            )}
        </div>
    );
}
