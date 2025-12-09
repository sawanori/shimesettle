'use client';

import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BankTransaction, BankAccount } from '@/types/supabase';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getCurrentFiscalYear, getSelectableFiscalYears, isInFiscalYear } from '@/lib/fiscalYear';

interface TransactionTableProps {
    transactions: BankTransaction[];
    accounts: BankAccount[];
}

export function TransactionTable({ transactions, accounts }: TransactionTableProps) {
    const [filterAccountId, setFilterAccountId] = useState<string>('ALL');
    const [filterFiscalYear, setFilterFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

    const fiscalYears = getSelectableFiscalYears();

    const filteredTransactions = transactions.filter((t) => {
        const matchesAccount = filterAccountId === 'ALL' || t.bank_account_id === filterAccountId;
        const matchesFiscalYear = filterFiscalYear === 'ALL'
            ? true
            : isInFiscalYear(t.transaction_date, parseInt(filterFiscalYear));
        return matchesAccount && matchesFiscalYear;
    });

    // 集計
    const totalDeposit = filteredTransactions.reduce((sum, t) => sum + t.deposit, 0);
    const totalWithdrawal = filteredTransactions.reduce((sum, t) => sum + t.withdrawal, 0);

    const getAccountName = (accountId: string) => {
        const account = accounts.find(a => a.id === accountId);
        return account?.name || '不明';
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-center flex-wrap">
                <Select value={filterAccountId} onValueChange={setFilterAccountId}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="口座を選択" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">全口座</SelectItem>
                        {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                                {account.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filterFiscalYear} onValueChange={setFilterFiscalYear}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="会計年度" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">全期間</SelectItem>
                        {fiscalYears.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                                {year}年度 ({year}/11〜{year + 1}/10)
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 集計表示 */}
            <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <div className="flex items-center text-green-600 dark:text-green-400">
                        <ArrowDownLeft className="h-4 w-4 mr-1" />
                        入金合計
                    </div>
                    <div className="text-lg font-bold">¥{totalDeposit.toLocaleString()}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <div className="flex items-center text-red-600 dark:text-red-400">
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        出金合計
                    </div>
                    <div className="text-lg font-bold">¥{totalWithdrawal.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-600 dark:text-gray-400">差額</div>
                    <div className={`text-lg font-bold ${totalDeposit - totalWithdrawal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ¥{(totalDeposit - totalWithdrawal).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="text-right text-sm text-gray-600">
                {filteredTransactions.length}件
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>取引日</TableHead>
                            <TableHead>口座</TableHead>
                            <TableHead>摘要</TableHead>
                            <TableHead className="text-right">入金</TableHead>
                            <TableHead className="text-right">出金</TableHead>
                            <TableHead className="text-right">残高</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    取引データがありません。CSVをインポートしてください。
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTransactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>{t.transaction_date}</TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {getAccountName(t.bank_account_id)}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={t.description}>
                                        {t.description}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-green-600">
                                        {t.deposit > 0 && `¥${t.deposit.toLocaleString()}`}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-red-600">
                                        {t.withdrawal > 0 && `¥${t.withdrawal.toLocaleString()}`}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-gray-500">
                                        {t.balance !== null && `¥${t.balance.toLocaleString()}`}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
