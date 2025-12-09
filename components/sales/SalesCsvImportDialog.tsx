'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { getSampleCsvFormat } from '@/lib/salesCsvParser';

interface ImportResult {
    success: boolean;
    message?: string;
    error?: string;
    imported?: number;
    skipped?: number;
    errors?: string[];
}

export function SalesCsvImportDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/sales/import-csv', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                setResult({
                    success: false,
                    error: data.error || 'インポートに失敗しました',
                    errors: data.details,
                });
            } else {
                setResult({
                    success: true,
                    message: data.message,
                    imported: data.imported,
                    skipped: data.skipped,
                    errors: data.errors,
                });

                if (data.imported > 0) {
                    router.refresh();
                }
            }
        } catch (error) {
            setResult({
                success: false,
                error: 'インポートに失敗しました',
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDownloadSample = () => {
        const csv = getSampleCsvFormat();
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sales_template.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleClose = () => {
        setOpen(false);
        setResult(null);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    CSV一括登録
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>売上CSV一括インポート</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="text-sm text-gray-600 space-y-2">
                        <p>CSVファイルから売上を一括登録できます。</p>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs font-mono">
                            <p className="font-semibold mb-1">必須カラム:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>取引日（2024/11/15 形式）</li>
                                <li>金額</li>
                                <li>取引先名</li>
                            </ul>
                            <p className="font-semibold mt-2 mb-1">任意カラム:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>事業区分（写真/動画/WEB/共通）</li>
                                <li>チャネル（直接/紹介/SNS/ウェブサイト/くらし/Totta/リピート）</li>
                                <li>入金状況（入金済/未入金）</li>
                            </ul>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadSample}
                        className="w-full"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        サンプルCSVをダウンロード
                    </Button>

                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="sales-csv-upload"
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="sales-csv-upload"
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
                                    <span className="text-xs text-gray-400 mt-1">
                                        UTF-8 または Shift-JIS
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
                                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={`font-medium ${
                                        result.success ? 'text-green-800' : 'text-red-800'
                                    }`}>
                                        {result.success ? result.message : result.error}
                                    </p>
                                    {result.success && (
                                        <ul className="text-sm text-gray-600 mt-1">
                                            <li>インポート: {result.imported}件</li>
                                            {result.skipped !== undefined && result.skipped > 0 && (
                                                <li>スキップ: {result.skipped}件</li>
                                            )}
                                        </ul>
                                    )}
                                    {result.errors && result.errors.length > 0 && (
                                        <div className="mt-2 text-xs text-gray-600 max-h-24 overflow-y-auto">
                                            {result.errors.slice(0, 5).map((err, i) => (
                                                <p key={i}>{err}</p>
                                            ))}
                                            {result.errors.length > 5 && (
                                                <p>...他{result.errors.length - 5}件のエラー</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
