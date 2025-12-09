'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils'; // Assuming this exists, or I'll use clsx/tailwind-merge directly if not. Usually shadcn projects have this.

interface FileUploaderProps {
    onFilesSelected: (files: File[]) => void;
    maxFiles?: number;
    accept?: string[]; // e.g. ['image/*', '.pdf']
    disabled?: boolean;
    className?: string;
    showPreview?: boolean; // If true, manages preview internally (simple mode). If false, parent manages it.
    // For this refactor, we'll keep it simple: this component handles selection and validation, 
    // but maybe we should let the parent handle the preview state if it's complex (like ReceiptUploader).
    // However, the ticket says "Create a reusable drag-and-drop file uploader".
    // Let's make it a pure UI component that handles the drop zone and file selection.
    // The parent can use it to trigger file selection.
    children?: React.ReactNode;
}

// Actually, looking at the requirements: "Implement drag-and-drop logic... Implement file validation... Provide visual feedback".
// And for ReceiptUploader: "Ensure the preview grid logic works with the files returned by FileUploader".
// This suggests FileUploader might just be the "Dropzone" part, or a full manager.
// Given InvoiceUploader (single) and ReceiptUploader (multiple + preview grid), 
// it might be best to make FileUploader a "Dropzone Area" that returns files, 
// and maybe a separate "FilePreviewGrid" if needed, or just let the parent handle previews.

// Let's implement a flexible Dropzone first.

export function FileUploader({
    onFilesSelected,
    maxFiles = 1,
    accept = ['image/*', '.pdf'],
    disabled = false,
    className,
    children,
}: FileUploaderProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        setIsDragOver(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const validateAndReturnFiles = useCallback((fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        const validFiles: File[] = [];

        // Simple validation based on accept (extensions and mime types)
        // This is a basic implementation. For robust checking we might need more logic,
        // but for now we'll rely on the input's accept attribute for the dialog,
        // and do a basic check for dropped files.

        // Note: 'accept' prop is mainly for the input element. 
        // For dropped files, we can check extensions/types if needed.
        // For this project, we know we want images and PDFs.

        for (const file of files) {
            const fileType = file.type;
            const fileName = file.name.toLowerCase();

            // Check if matches at least one accept criteria
            const isValid = accept.some(criteria => {
                if (criteria.endsWith('/*')) {
                    const baseType = criteria.slice(0, -2);
                    return fileType.startsWith(baseType);
                } else if (criteria.startsWith('.')) {
                    return fileName.endsWith(criteria.toLowerCase());
                } else {
                    return fileType === criteria;
                }
            });

            if (isValid) {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0 && files.length > 0) {
            alert('対応していないファイル形式です。');
            return;
        }

        if (validFiles.length > maxFiles) {
            alert(`最大${maxFiles}枚までアップロードできます。`);
            // Take only the first N files
            onFilesSelected(validFiles.slice(0, maxFiles));
        } else {
            onFilesSelected(validFiles);
        }
    }, [accept, maxFiles, onFilesSelected]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (disabled) return;

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles.length > 0) {
            validateAndReturnFiles(droppedFiles);
        }
    }, [disabled, validateAndReturnFiles]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            validateAndReturnFiles(selectedFiles);
        }
        // Reset input value to allow selecting the same file again
        e.target.value = '';
    };

    const handleClick = () => {
        if (!disabled && inputRef.current) {
            inputRef.current.click();
        }
    };

    return (
        <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                isDragOver
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/25 hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                className
            )}
        >
            {children ? (
                children
            ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                    <Upload className={cn("w-8 h-8 mb-3", isDragOver ? "text-primary" : "text-muted-foreground")} />
                    <p className="mb-1 text-sm text-muted-foreground">
                        <span className="font-semibold">クリック</span> または <span className="font-semibold">ドラッグ＆ドロップ</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                        {accept.join(', ').replace(/image\/\*/g, '画像').replace(/\./g, '').toUpperCase()}
                        {maxFiles > 1 ? `（最大${maxFiles}枚）` : ''}
                    </p>
                </div>
            )}
            <Input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={accept.join(',')}
                onChange={handleFileChange}
                disabled={disabled}
                multiple={maxFiles > 1}
            />
        </div>
    );
}
