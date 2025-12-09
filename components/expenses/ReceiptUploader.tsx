'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, FileText, Plus } from 'lucide-react';
import { FileUploader } from '@/components/ui/file-uploader';

const MAX_FILES = 4;

interface SelectedFile {
    id: string;
    file: File;
    previewUrl: string | null;
}

interface ReceiptUploaderProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
}

export function ReceiptUploader({ onFilesSelected, disabled }: ReceiptUploaderProps) {
    const [files, setFiles] = useState<SelectedFile[]>([]);

    const notifyParent = useCallback((updatedFiles: SelectedFile[]) => {
        onFilesSelected(updatedFiles.map(f => f.file));
    }, [onFilesSelected]);

    const handleFilesSelected = useCallback((newFiles: File[]) => {
        const remainingSlots = MAX_FILES - files.length;

        if (remainingSlots <= 0) {
            alert(`最大${MAX_FILES}枚までアップロードできます。`);
            return;
        }

        const filesToAdd = newFiles.slice(0, remainingSlots);

        if (newFiles.length > remainingSlots) {
            alert(`${newFiles.length - remainingSlots}件のファイルがスキップされました（最大${MAX_FILES}枚）`);
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

    const removeFile = (fileId: string) => {
        const updated = files.filter(f => f.id !== fileId);
        setFiles(updated);
        notifyParent(updated);
    };

    const clearAll = () => {
        setFiles([]);
        notifyParent([]);
    };

    const canAddMore = files.length < MAX_FILES;

    return (
        <div className="grid w-full items-center gap-1.5">
            <div className="flex justify-between items-center">
                <Label>領収書画像（最大{MAX_FILES}枚）</Label>
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
                <div className="grid grid-cols-2 gap-2 mb-2">
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
                        <FileUploader
                            onFilesSelected={handleFilesSelected}
                            maxFiles={MAX_FILES - files.length}
                            accept={['image/*', '.pdf']}
                            disabled={disabled}
                            className="aspect-square border-dashed hover:bg-muted/50"
                        >
                            <div className="flex flex-col items-center justify-center h-full">
                                <Plus className="h-8 w-8 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground mt-1">追加</span>
                            </div>
                        </FileUploader>
                    )}
                </div>
            )}

            {/* Initial dropzone */}
            {files.length === 0 && (
                <FileUploader
                    onFilesSelected={handleFilesSelected}
                    maxFiles={MAX_FILES}
                    accept={['image/*', '.pdf']}
                    disabled={disabled}
                    className="h-48"
                />
            )}
        </div>
    );
}
