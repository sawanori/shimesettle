'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { BankAccount, BankType } from '@/types/supabase';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface CsvImportDialogProps {
    account: BankAccount;
    onSuccess: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    showTrigger?: boolean;
}

interface ImportResult {
    success: boolean;
    message: string;
    imported?: number;
    skipped?: number;
    duplicates?: number;
}

export function CsvImportDialog({
    account,
    onSuccess,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    showTrigger = true
}: CsvImportDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Support both controlled and uncontrolled modes
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (v: boolean) => controlledOnOpenChange?.(v) : setInternalOpen;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bankAccountId', account.id);
            formData.append('bankType', account.bank_type);

            const response = await fetch('/api/bank/import-csv', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const data = await response.json();

            if (!response.ok) {
                setResult({
                    success: false,
                    message: data.error || 'インポートに失敗しました',
                });
            } else {
                setResult({
                    success: true,
                    message: data.message,
                    imported: data.imported,
                    skipped: data.skipped,
                    duplicates: data.duplicates,
                });

                if (data.imported > 0) {
                    onSuccess();
                }
            }
        } catch (error) {
            setResult({
                success: false,
                message: 'インポートに失敗しました',
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleClose = () => {
        setOpen(false);
        setResult(null);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
            {showTrigger && (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        CSV取込
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>CSVインポート - {account.name}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                        <p className="mb-2">銀行からダウンロードしたCSVファイルを選択してください。</p>
                        <p className="text-xs">対応形式: {account.bank_type === 'RAKUTEN' ? 'UTF-8' : 'Shift-JIS'}</p>
                    </div>

                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="csv-upload"
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="csv-upload"
                            className="cursor-pointer flex flex-col items-center"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-10 w-10 text-gray-400 animate-spin mb-2" />
                                    <span className="text-sm text-gray-500">処理中...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500">
                                        クリックしてCSVを選択
                                    </span>
                                </>
                            )}
                        </label>
                    </div>

                    {result && (
                        <div className={`rounded-lg p-4 ${
                            result.success ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                            <div className="flex items-start">
                                {result.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                                )}
                                <div>
                                    <p className={`font-medium ${
                                        result.success ? 'text-green-800' : 'text-red-800'
                                    }`}>
                                        {result.message}
                                    </p>
                                    {result.success && result.imported !== undefined && (
                                        <ul className="text-sm text-gray-600 mt-1">
                                            <li>インポート: {result.imported}件</li>
                                            {result.duplicates !== undefined && result.duplicates > 0 && (
                                                <li>重複スキップ: {result.duplicates}件</li>
                                            )}
                                            {result.skipped !== undefined && result.skipped > 0 && (
                                                <li>無効な行: {result.skipped}件</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-gray-500 space-y-1">
                        <p>※ 同じ取引は自動的に重複チェックされます</p>
                        <p>※ 対応銀行: 三菱UFJ、三井住友、みずほ、ゆうちょ、楽天、PayPay、GMOあおぞら</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
