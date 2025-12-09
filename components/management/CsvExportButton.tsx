'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { AccountCategory } from '@/types/supabase';

interface CsvExportButtonProps {
    type: 'expenses' | 'sales' | 'bank_accounts' | 'bank_transactions';
    fiscalYear?: number;
    department?: string;
    channel?: string;
    accountCategory?: AccountCategory | 'ALL';
    bankAccountId?: string;
}

export function CsvExportButton({ type, fiscalYear, department, channel, accountCategory, bankAccountId }: CsvExportButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const params = new URLSearchParams();
            params.set('type', type);
            if (fiscalYear) {
                params.set('fiscalYear', fiscalYear.toString());
            }
            if (department && department !== 'ALL') {
                params.set('department', department);
            }
            if (channel && channel !== 'ALL') {
                params.set('channel', channel);
            }
            if (accountCategory && accountCategory !== 'ALL') {
                params.set('accountCategory', accountCategory);
            }
            if (bankAccountId && bankAccountId !== 'ALL') {
                params.set('bankAccountId', bankAccountId);
            }

            const response = await fetch(`/api/export-csv?${params.toString()}`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('ダウンロードに失敗しました');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // ファイル名を適切に設定
            let filename: string = type;
            if (type === 'bank_accounts') {
                const categoryLabel = accountCategory && accountCategory !== 'ALL'
                    ? `_${accountCategory === 'BUSINESS' ? 'ビジネス' : '個人'}`
                    : '';
                filename = `bank_accounts${categoryLabel}.csv`;
            } else if (type === 'bank_transactions') {
                const categoryLabel = accountCategory && accountCategory !== 'ALL'
                    ? `_${accountCategory === 'BUSINESS' ? 'ビジネス' : '個人'}`
                    : '';
                filename = `bank_transactions${categoryLabel}_${fiscalYear ? `${fiscalYear}年度` : 'all'}.csv`;
            } else {
                filename = `${type}_${fiscalYear ? `${fiscalYear}年度` : 'all'}.csv`;
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(error);
            alert('ダウンロードに失敗しました');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'ダウンロード中...' : 'CSV出力 (Shift-JIS)'}
        </Button>
    );
}
