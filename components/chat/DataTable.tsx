'use client';

import type { QueryResult } from '@/lib/chat/types';
import { formatCurrency } from '@/lib/chat/utils';
import { Download } from 'lucide-react';

interface DataTableProps {
    data: QueryResult;
}

export function DataTable({ data }: DataTableProps) {
    if (!data.data || data.data.length === 0) {
        return null;
    }

    const columns =
        data.columns ||
        Object.keys(data.data[0]).map((key) => ({
            key,
            label: key,
        }));

    // CSVエクスポート
    const handleExport = () => {
        const headers = columns.map((c) => c.label).join(',');
        const rows = data.data.map((row) =>
            columns
                .map((c) => {
                    const value = row[c.key];
                    // 数値の場合はそのまま、それ以外はクォートで囲む
                    return typeof value === 'number' ? value : `"${value || ''}"`;
                })
                .join(',')
        );
        const csv = [headers, ...rows].join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.title || 'data'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // セル値のフォーマット
    const formatCellValue = (value: any, key: string): string => {
        if (value === null || value === undefined) {
            return '-';
        }

        // 金額系のキーの場合
        if (
            key.includes('amount') ||
            key.includes('total') ||
            key.includes('balance')
        ) {
            return formatCurrency(Number(value));
        }

        return String(value);
    };

    return (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
            {data.title && (
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-600">
                        {data.title}
                    </span>
                    <button
                        onClick={handleExport}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="CSVダウンロード"
                    >
                        <Download className="w-3 h-3 text-gray-500" />
                    </button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-gray-50">
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-gray-100">
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className="px-3 py-2 whitespace-nowrap"
                                    >
                                        {formatCellValue(row[column.key], column.key)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data.total !== undefined && (
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-right">
                    <span className="text-xs text-gray-500">合計: </span>
                    <span className="text-sm font-medium">
                        {formatCurrency(data.total)}
                    </span>
                </div>
            )}
        </div>
    );
}
