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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle, Clock, Trash2, Building2, FileDown, Pencil, Briefcase, User, FileCheck, Eye, Download, Search } from 'lucide-react';
import { SearchInput } from '@/components/ui/search-input';
import { Expense, Sale, BankAccount, BankTransaction, CsvImport, AccountCategory, Document, AccountType } from '@/types/supabase';
import { CsvExportButton } from './CsvExportButton';
import { BankAccountForm } from '@/components/bank/BankAccountForm';
import { EditExpenseDialog } from './EditExpenseDialog';
import { EditSaleDialog } from './EditSaleDialog';
import { getBankTypeName } from '@/lib/bankCsvParser';
import { createClient } from '@/utils/supabase/client';
import {
    getCurrentFiscalYear,
    getSelectableFiscalYears,
    isInFiscalYear,
} from '@/lib/fiscalYear';

type ViewType = 'expenses' | 'sales' | 'bank_accounts' | 'bank_transactions' | 'documents';

interface ManagementTableProps {
    initialExpenses: Expense[];
    initialSales: Sale[];
    initialBankAccounts: BankAccount[];
    initialBankTransactions: BankTransaction[];
    initialCsvImports: CsvImport[];
    initialDocuments: Document[];
}

export function ManagementTable({
    initialExpenses,
    initialSales,
    initialBankAccounts,
    initialBankTransactions,
    initialCsvImports,
    initialDocuments,
}: ManagementTableProps) {
    const [viewType, setViewType] = useState<ViewType>('expenses');
    const [filterFiscalYear, setFilterFiscalYear] = useState<string>('ALL');
    const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
    const [filterChannel, setFilterChannel] = useState<string>('ALL');
    const [filterBankAccount, setFilterBankAccount] = useState<string>('ALL');
    const [filterAccountCategory, setFilterAccountCategory] = useState<AccountCategory | 'ALL'>('ALL');
    const [filterAccountType, setFilterAccountType] = useState<AccountType | 'ALL'>('ALL');
    const [filterDocumentType, setFilterDocumentType] = useState<string>('ALL');
    const [filterFolderNumber, setFilterFolderNumber] = useState<string>('');
    // キーワード検索用state
    const [searchExpenseKeyword, setSearchExpenseKeyword] = useState<string>('');
    const [searchSaleKeyword, setSearchSaleKeyword] = useState<string>('');
    const [searchDocumentKeyword, setSearchDocumentKeyword] = useState<string>('');
    // 書類一括ダウンロード用state
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
    const [bankAccounts, setBankAccounts] = useState(initialBankAccounts);
    const [bankTransactions, setBankTransactions] = useState(initialBankTransactions);
    const [csvImports, setCsvImports] = useState(initialCsvImports);
    const [documents, setDocuments] = useState(initialDocuments);

    // Edit state
    const [expenses, setExpenses] = useState(initialExpenses);
    const [sales, setSales] = useState(initialSales);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
    const [isEditSaleOpen, setIsEditSaleOpen] = useState(false);

    const supabase = createClient();

    // Parse file_path which can be a single URL, JSON array, or relative path
    const parseFilePaths = (filePath: string | null): string[] => {
        if (!filePath) return [];

        // Try to parse as JSON array
        if (filePath.startsWith('[')) {
            try {
                const parsed = JSON.parse(filePath);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // Not valid JSON, treat as single value
            }
        }

        // Single value
        return [filePath];
    };

    const getFileUrl = (filePath: string): string => {
        // If already a full URL, return as-is
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            return filePath;
        }
        // Otherwise, generate URL from receipts bucket
        const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
        return data?.publicUrl || filePath;
    };

    const getStatusIcon = (status: string | null) => {
        if (status === 'WARNING') return <AlertTriangle className="h-4 w-4 text-red-500" />;
        if (status === 'OK') return <CheckCircle className="h-4 w-4 text-green-500" />;
        return <Clock className="h-4 w-4 text-gray-400" />;
    };

    const fiscalYears = getSelectableFiscalYears();

    // Edit handlers
    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setIsEditExpenseOpen(true);
    };

    const handleUpdateExpense = (updatedExpense: Expense) => {
        setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('この経費を削除しますか？')) return;

        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (!error) {
            setExpenses(prev => prev.filter(e => e.id !== id));
        } else {
            alert('削除に失敗しました');
        }
    };

    const handleEditSale = (sale: Sale) => {
        setEditingSale(sale);
        setIsEditSaleOpen(true);
    };

    const handleUpdateSale = (updatedSale: Sale) => {
        setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    };

    const handleDeleteSale = async (id: string) => {
        if (!confirm('この売上を削除しますか？')) return;

        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (!error) {
            setSales(prev => prev.filter(s => s.id !== id));
        } else {
            alert('削除に失敗しました');
        }
    };

    const handleRefreshBankAccounts = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('bank_accounts')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setBankAccounts(data);
    };

    const handleDeleteBankAccount = async (id: string) => {
        if (!confirm('この口座を削除しますか？関連する取引もすべて削除されます。')) return;

        try {
            const supabase = createClient();

            // 外部キーがCASCADE設定なので、bank_accountsを削除すれば関連データも自動削除される
            const { error, count } = await supabase
                .from('bank_accounts')
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                console.error('Delete error:', error);
                alert('削除に失敗しました: ' + error.message);
                return;
            }

            // UIを更新
            setBankAccounts(prev => prev.filter(a => a.id !== id));
            setBankTransactions(prev => prev.filter(t => t.bank_account_id !== id));
            setCsvImports(prev => prev.filter(i => i.bank_account_id !== id));
            alert('口座を削除しました');
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('予期しないエラーが発生しました');
        }
    };

    const handleDownloadCsv = async (importId: string, fileName: string) => {
        try {
            const response = await fetch(`/api/bank/download-csv?id=${importId}`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('ダウンロードに失敗しました');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(error);
            alert('ダウンロードに失敗しました');
        }
    };

    // 口座ごとのインポート履歴を取得
    const getImportsForAccount = (accountId: string) => {
        return csvImports.filter(i => i.bank_account_id === accountId);
    };

    // Document handlers
    const handleDeleteDocument = async (id: string) => {
        if (!confirm('この書類を削除しますか？')) return;

        const { error } = await supabase.from('documents').delete().eq('id', id);
        if (!error) {
            setDocuments(prev => prev.filter(d => d.id !== id));
        } else {
            alert('削除に失敗しました');
        }
    };

    const handleDownloadDocument = async (filePath: string, fileName: string) => {
        try {
            // プライベートバケットの場合は署名付きURLを使用
            // file_pathがフルURLの場合はそのまま使用
            let downloadUrl: string;

            if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                downloadUrl = filePath;
            } else {
                // 署名付きURL（60秒有効）を生成
                const { data: signedData, error: signedError } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(filePath, 60);

                if (signedError || !signedData?.signedUrl) {
                    console.error('Signed URL error:', signedError);
                    alert('ダウンロードURLの生成に失敗しました');
                    return;
                }
                downloadUrl = signedData.signedUrl;
            }

            // ダウンロード実行
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('ダウンロードに失敗しました');
        }
    };

    // 書類選択ハンドラー
    const handleToggleDocumentSelection = (id: string) => {
        setSelectedDocumentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleToggleAllDocuments = () => {
        if (selectedDocumentIds.size === filteredDocuments.length) {
            // 全選択解除
            setSelectedDocumentIds(new Set());
        } else {
            // 全選択
            setSelectedDocumentIds(new Set(filteredDocuments.map(doc => doc.id)));
        }
    };

    // 一括ダウンロード
    const handleBulkDownloadDocuments = async () => {
        const selectedDocs = filteredDocuments.filter(doc => selectedDocumentIds.has(doc.id));
        if (selectedDocs.length === 0) return;

        // 確認ダイアログ
        if (!confirm(`${selectedDocs.length}件の書類をダウンロードしますか？`)) return;

        // 順次ダウンロード（ブラウザの制限を考慮して少し間隔を空ける）
        for (let i = 0; i < selectedDocs.length; i++) {
            const doc = selectedDocs[i];
            await handleDownloadDocument(doc.file_path, doc.file_name);
            // 次のダウンロードまで少し待機（ブラウザがブロックしないように）
            if (i < selectedDocs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // 選択解除
        setSelectedDocumentIds(new Set());
    };

    const getDocumentUrl = (filePath: string): string => {
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            return filePath;
        }
        const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
        return data?.publicUrl || filePath;
    };

    // Filter expenses/sales by fiscal year, department, folder number, and keyword
    const filteredExpenses = expenses.filter((item) => {
        const matchesFiscalYear = filterFiscalYear !== 'ALL'
            ? isInFiscalYear(item.transaction_date, parseInt(filterFiscalYear))
            : true;
        const matchesDept = filterDepartment !== 'ALL' ? item.department === filterDepartment : true;
        const matchesFolderNumber = filterFolderNumber
            ? item.folder_number?.includes(filterFolderNumber)
            : true;
        // キーワード検索: 摘要・勘定科目を検索（大文字小文字を区別しない）
        const matchesKeyword = searchExpenseKeyword
            ? (() => {
                const keyword = searchExpenseKeyword.toLowerCase();
                const description = (item.description || '').toLowerCase();
                const accountItem = (item.account_item || '').toLowerCase();
                return description.includes(keyword) || accountItem.includes(keyword);
            })()
            : true;
        return matchesFiscalYear && matchesDept && matchesFolderNumber && matchesKeyword;
    });

    const filteredSales = sales.filter((item) => {
        const matchesFiscalYear = filterFiscalYear !== 'ALL'
            ? isInFiscalYear(item.transaction_date, parseInt(filterFiscalYear))
            : true;
        const matchesDept = filterDepartment !== 'ALL' ? item.department === filterDepartment : true;
        const matchesChannel = filterChannel !== 'ALL' ? item.channel === filterChannel : true;
        // キーワード検索: 取引先名を検索（大文字小文字を区別しない）
        const matchesKeyword = searchSaleKeyword
            ? (item.client_name || '').toLowerCase().includes(searchSaleKeyword.toLowerCase())
            : true;
        return matchesFiscalYear && matchesDept && matchesChannel && matchesKeyword;
    });

    // Filter bank accounts by category and type
    const filteredBankAccounts = bankAccounts.filter((account) => {
        const matchesCategory = filterAccountCategory !== 'ALL'
            ? (account.category || 'BUSINESS') === filterAccountCategory
            : true;
        const matchesType = filterAccountType !== 'ALL'
            ? (account.account_type || 'BANK') === filterAccountType
            : true;
        return matchesCategory && matchesType;
    });

    // Filter bank transactions by account and fiscal year
    const filteredBankTransactions = bankTransactions.filter((item) => {
        const matchesFiscalYear = filterFiscalYear !== 'ALL'
            ? isInFiscalYear(item.transaction_date, parseInt(filterFiscalYear))
            : true;
        const matchesAccount = filterBankAccount !== 'ALL'
            ? item.bank_account_id === filterBankAccount
            : true;
        // カテゴリフィルターがかかっている場合、そのカテゴリの口座の取引のみ表示
        const account = bankAccounts.find(a => a.id === item.bank_account_id);
        const matchesCategory = filterAccountCategory !== 'ALL'
            ? (account?.category || 'BUSINESS') === filterAccountCategory
            : true;
        const matchesType = filterAccountType !== 'ALL'
            ? (account?.account_type || 'BANK') === filterAccountType
            : true;
        return matchesFiscalYear && matchesAccount && matchesCategory && matchesType;
    });

    // Filter documents by type and keyword
    const filteredDocuments = documents.filter((doc) => {
        const matchesType = filterDocumentType !== 'ALL' ? doc.document_type === filterDocumentType : true;
        // キーワード検索: タイトル・ファイル名・説明を検索（大文字小文字を区別しない）
        const matchesKeyword = searchDocumentKeyword
            ? (() => {
                const keyword = searchDocumentKeyword.toLowerCase();
                const title = (doc.title || '').toLowerCase();
                const fileName = (doc.file_name || '').toLowerCase();
                const description = (doc.description || '').toLowerCase();
                return title.includes(keyword) || fileName.includes(keyword) || description.includes(keyword);
            })()
            : true;
        return matchesType && matchesKeyword;
    });

    // Calculate totals
    const expensesTotal = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    const salesTotal = filteredSales.reduce((sum, item) => sum + item.amount, 0);
    const transactionsDeposit = filteredBankTransactions.reduce((sum, item) => sum + item.deposit, 0);
    const transactionsWithdrawal = filteredBankTransactions.reduce((sum, item) => sum + item.withdrawal, 0);

    const getAccountName = (accountId: string) => {
        const account = bankAccounts.find(a => a.id === accountId);
        return account?.name || '不明';
    };

    const getAccountWithCategory = (accountId: string) => {
        const account = bankAccounts.find(a => a.id === accountId);
        return {
            name: account?.name || '不明',
            category: account?.category || 'BUSINESS' as AccountCategory,
        };
    };

    return (
        <div className="space-y-4">
            {/* Tab Buttons */}
            <div className="flex gap-2 border-b pb-2">
                <Button
                    variant={viewType === 'expenses' ? 'default' : 'ghost'}
                    onClick={() => setViewType('expenses')}
                    size="sm"
                >
                    経費
                </Button>
                <Button
                    variant={viewType === 'sales' ? 'default' : 'ghost'}
                    onClick={() => setViewType('sales')}
                    size="sm"
                >
                    売上
                </Button>
                <Button
                    variant={viewType === 'bank_accounts' ? 'default' : 'ghost'}
                    onClick={() => setViewType('bank_accounts')}
                    size="sm"
                >
                    <Building2 className="mr-1 h-4 w-4" />
                    銀行口座
                </Button>
                <Button
                    variant={viewType === 'bank_transactions' ? 'default' : 'ghost'}
                    onClick={() => setViewType('bank_transactions')}
                    size="sm"
                >
                    銀行取引
                </Button>
                <Button
                    variant={viewType === 'documents' ? 'default' : 'ghost'}
                    onClick={() => setViewType('documents')}
                    size="sm"
                >
                    <FileCheck className="mr-1 h-4 w-4" />
                    書類
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center">
                <div className="flex gap-2 items-center flex-wrap">
                    {(viewType === 'expenses' || viewType === 'sales' || viewType === 'bank_transactions') && (
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
                    )}

                    {(viewType === 'expenses' || viewType === 'sales') && (
                        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="事業区分" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">全事業区分</SelectItem>
                                <SelectItem value="PHOTO">写真事業</SelectItem>
                                <SelectItem value="VIDEO">動画事業</SelectItem>
                                <SelectItem value="WEB">WEB制作</SelectItem>
                                <SelectItem value="COMMON">共通経費</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {viewType === 'expenses' && (
                        <>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="No.検索"
                                    value={filterFolderNumber}
                                    onChange={(e) => setFilterFolderNumber(e.target.value)}
                                    className="w-[100px] pl-8 h-9 font-mono"
                                />
                            </div>
                            <SearchInput
                                placeholder="摘要・勘定科目で検索"
                                value={searchExpenseKeyword}
                                onChange={setSearchExpenseKeyword}
                                className="w-[200px]"
                            />
                        </>
                    )}

                    {viewType === 'sales' && (
                        <>
                            <Select value={filterChannel} onValueChange={setFilterChannel}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="チャネル" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">全チャネル</SelectItem>
                                    <SelectItem value="DIRECT">直接営業</SelectItem>
                                    <SelectItem value="REFERRAL">紹介</SelectItem>
                                    <SelectItem value="SNS">SNS</SelectItem>
                                    <SelectItem value="WEBSITE">ウェブサイト</SelectItem>
                                    <SelectItem value="PLATFORM_KURASHI">くらしのマーケット</SelectItem>
                                    <SelectItem value="PLATFORM_TOTTA">Totta</SelectItem>
                                    <SelectItem value="REPEAT">リピート</SelectItem>
                                    <SelectItem value="OTHER">その他</SelectItem>
                                </SelectContent>
                            </Select>
                            <SearchInput
                                placeholder="取引先名で検索"
                                value={searchSaleKeyword}
                                onChange={setSearchSaleKeyword}
                                className="w-[180px]"
                            />
                        </>
                    )}

                    {(viewType === 'bank_accounts' || viewType === 'bank_transactions') && (
                        <>
                            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setFilterAccountCategory('ALL')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterAccountCategory === 'ALL'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    カテゴリ全
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterAccountCategory('BUSINESS')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterAccountCategory === 'BUSINESS'
                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <Briefcase className="h-3.5 w-3.5" />
                                    ビジネス
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterAccountCategory('PERSONAL')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterAccountCategory === 'PERSONAL'
                                        ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 shadow-sm'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <User className="h-3.5 w-3.5" />
                                    個人
                                </button>
                            </div>

                            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setFilterAccountType('ALL')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterAccountType === 'ALL'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    種別全
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterAccountType('BANK')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterAccountType === 'BANK'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    銀行
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterAccountType('CREDIT_CARD')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterAccountType === 'CREDIT_CARD'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    カード
                                </button>
                            </div>
                        </>
                    )}

                    {viewType === 'bank_transactions' && bankAccounts.length > 0 && (
                        <Select value={filterBankAccount} onValueChange={setFilterBankAccount}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="口座" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">全口座</SelectItem>
                                {filteredBankAccounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                        {account.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {viewType === 'documents' && (
                        <>
                            <Select value={filterDocumentType} onValueChange={setFilterDocumentType}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="書類種別" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">すべて</SelectItem>
                                    <SelectItem value="証明書">証明書</SelectItem>
                                    <SelectItem value="契約書">契約書</SelectItem>
                                    <SelectItem value="許可証">許可証</SelectItem>
                                    <SelectItem value="届出書">届出書</SelectItem>
                                    <SelectItem value="その他">その他</SelectItem>
                                </SelectContent>
                            </Select>
                            <SearchInput
                                placeholder="タイトル・ファイル名で検索"
                                value={searchDocumentKeyword}
                                onChange={setSearchDocumentKeyword}
                                className="w-[200px]"
                            />
                        </>
                    )}
                </div>

                <div className="flex gap-2">
                    {viewType === 'bank_accounts' && (
                        <>
                            <CsvExportButton
                                type="bank_accounts"
                                accountCategory={filterAccountCategory}
                            />
                            <BankAccountForm
                                onSuccess={handleRefreshBankAccounts}
                                defaultCategory={filterAccountCategory !== 'ALL' ? filterAccountCategory : 'BUSINESS'}
                            />
                        </>
                    )}
                    {viewType === 'bank_transactions' && (
                        <CsvExportButton
                            type="bank_transactions"
                            fiscalYear={filterFiscalYear !== 'ALL' ? parseInt(filterFiscalYear) : undefined}
                            accountCategory={filterAccountCategory}
                            bankAccountId={filterBankAccount}
                        />
                    )}
                    {(viewType === 'expenses' || viewType === 'sales') && (
                        <CsvExportButton
                            type={viewType}
                            fiscalYear={filterFiscalYear !== 'ALL' ? parseInt(filterFiscalYear) : undefined}
                            department={filterDepartment}
                            channel={viewType === 'sales' ? filterChannel : undefined}
                        />
                    )}
                    {viewType === 'documents' && selectedDocumentIds.size > 0 && (
                        <Button
                            onClick={handleBulkDownloadDocuments}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            {selectedDocumentIds.size}件をダウンロード
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary */}
            {viewType === 'expenses' && (
                <div className="text-right text-sm text-gray-600">
                    {filteredExpenses.length}件 / 合計: <span className="font-bold text-lg">¥{expensesTotal.toLocaleString()}</span>
                </div>
            )}
            {viewType === 'sales' && (
                <div className="text-right text-sm text-gray-600">
                    {filteredSales.length}件 / 合計: <span className="font-bold text-lg">¥{salesTotal.toLocaleString()}</span>
                </div>
            )}
            {viewType === 'bank_accounts' && (
                <div className="text-right text-sm text-gray-600">
                    {filterAccountCategory !== 'ALL' && (
                        <span className={`mr-2 px-2 py-0.5 rounded text-xs ${filterAccountCategory === 'BUSINESS'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            }`}>
                            {filterAccountCategory === 'BUSINESS' ? 'ビジネス' : '個人'}
                        </span>
                    )}
                    {filteredBankAccounts.length}件の口座
                    {filterAccountCategory !== 'ALL' && bankAccounts.length !== filteredBankAccounts.length && (
                        <span className="text-gray-400 ml-1">（全{bankAccounts.length}件）</span>
                    )}
                </div>
            )}
            {viewType === 'bank_transactions' && (
                <div className="text-right text-sm text-gray-600">
                    {filteredBankTransactions.length}件
                    {filterAccountType !== 'CREDIT_CARD' && (
                        <> / 入金: <span className="text-green-600 font-bold">¥{transactionsDeposit.toLocaleString()}</span></>
                    )}
                    {' / '}{filterAccountType === 'CREDIT_CARD' ? '利用' : '出金'}: <span className="text-red-600 font-bold">¥{transactionsWithdrawal.toLocaleString()}</span>
                </div>
            )}
            {viewType === 'documents' && (
                <div className="text-right text-sm text-gray-600">
                    {filteredDocuments.length}件の書類
                    {filterDocumentType !== 'ALL' && documents.length !== filteredDocuments.length && (
                        <span className="text-gray-400 ml-1">（全{documents.length}件）</span>
                    )}
                </div>
            )}

            {/* Tables */}
            <div className="rounded-md border">
                {/* Expenses Table */}
                {viewType === 'expenses' && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>領収書</TableHead>
                                <TableHead className="w-16">No.</TableHead>
                                <TableHead>取引日</TableHead>
                                <TableHead>事業区分</TableHead>
                                <TableHead>勘定科目</TableHead>
                                <TableHead>摘要</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                                <TableHead className="text-center">AI監査</TableHead>
                                <TableHead className="text-center">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExpenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center h-24">
                                        データが見つかりません。
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredExpenses.map((item) => {
                                    const files = parseFilePaths(item.file_path);
                                    return (
                                        <TableRow key={item.id} className={
                                            item.ai_check_status === 'WARNING'
                                                ? 'bg-red-50 dark:bg-red-900/20'
                                                : ''
                                        }>
                                            <TableCell>
                                                {files.length === 0 ? (
                                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                                        <span className="text-gray-400 text-xs">なし</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1">
                                                        {files.slice(0, 3).map((file, idx) => {
                                                            const fileUrl = getFileUrl(file);
                                                            const isPdf = file.toLowerCase().endsWith('.pdf');
                                                            return (
                                                                <a
                                                                    key={idx}
                                                                    href={fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="relative block w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
                                                                    title={`ファイル ${idx + 1} を開く`}
                                                                >
                                                                    {isPdf ? (
                                                                        <iframe
                                                                            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                                                            className="w-full h-full border-0 scale-100 origin-top-left"
                                                                            title={`領収書 ${idx + 1}`}
                                                                        />
                                                                    ) : (
                                                                        <img
                                                                            src={fileUrl}
                                                                            alt={`領収書 ${idx + 1}`}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    )}
                                                                    {/* Clickable overlay to prevent browser controls and enable link */}
                                                                    <span className="absolute inset-0 z-10" />
                                                                </a>
                                                            );
                                                        })}
                                                        {files.length > 3 && (
                                                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                                                                <span className="text-xs text-gray-600 dark:text-gray-300">+{files.length - 3}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-center">
                                                {item.folder_number ? (
                                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                                        {item.folder_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{item.transaction_date}</TableCell>
                                            <TableCell>
                                                <DepartmentBadge department={item.department} />
                                            </TableCell>
                                            <TableCell>{item.account_item}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={item.description || ''}>
                                                {item.description || '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                ¥{item.amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center" title={item.ai_audit_note || ''}>
                                                    {getStatusIcon(item.ai_check_status)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditExpense(item)}
                                                    >
                                                        <Pencil className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteExpense(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}

                {/* Sales Table */}
                {viewType === 'sales' && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>取引日</TableHead>
                                <TableHead>事業区分</TableHead>
                                <TableHead>取引先</TableHead>
                                <TableHead>チャネル</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                                <TableHead className="text-right">手数料</TableHead>
                                <TableHead className="text-right">手取り</TableHead>
                                <TableHead className="text-center">入金</TableHead>
                                <TableHead className="text-center">ファイル</TableHead>
                                <TableHead className="text-center">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSales.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center h-24">
                                        データが見つかりません。
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSales.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.transaction_date}</TableCell>
                                        <TableCell>
                                            <DepartmentBadge department={item.department} />
                                        </TableCell>
                                        <TableCell>{item.client_name}</TableCell>
                                        <TableCell>
                                            <ChannelBadge channel={item.channel} />
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            ¥{item.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                                            {item.fee_amount ? (
                                                <span title={item.fee_rate ? `${item.fee_rate}%` : ''}>
                                                    -¥{item.fee_amount.toLocaleString()}
                                                    {item.fee_rate && <span className="text-xs ml-1">({item.fee_rate}%)</span>}
                                                </span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                                            {item.net_amount ? `¥${item.net_amount.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.status === 'PAID' ? (
                                                <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                            ) : (
                                                <Clock className="h-4 w-4 text-yellow-500 mx-auto" />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {(() => {
                                                const files = parseFilePaths(item.file_path);
                                                if (files.length === 0) {
                                                    return <span className="text-gray-300">-</span>;
                                                }
                                                if (files.length === 1) {
                                                    return (
                                                        <a
                                                            href={getFileUrl(files[0])}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                                            title="ファイルをダウンロード"
                                                        >
                                                            <FileDown className="h-4 w-4" />
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <div className="flex items-center justify-center gap-1">
                                                        {files.map((file, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={getFileUrl(file)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                                                title={`ファイル ${idx + 1}`}
                                                            >
                                                                <FileDown className="h-3 w-3" />
                                                            </a>
                                                        ))}
                                                        <span className="text-xs text-gray-500 ml-1">({files.length})</span>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditSale(item)}
                                                >
                                                    <Pencil className="h-4 w-4 text-gray-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteSale(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}

                {/* Bank Accounts Table */}
                {viewType === 'bank_accounts' && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>口座名</TableHead>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead>銀行</TableHead>
                                <TableHead>支店</TableHead>
                                <TableHead>口座番号</TableHead>
                                <TableHead className="text-right">開始残高</TableHead>
                                <TableHead>インポート履歴</TableHead>
                                <TableHead className="text-center">状態</TableHead>
                                <TableHead className="text-center">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBankAccounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center h-24">
                                        {filterAccountCategory !== 'ALL'
                                            ? `${filterAccountCategory === 'BUSINESS' ? 'ビジネス' : '個人'}口座が登録されていません。`
                                            : '銀行口座が登録されていません。'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredBankAccounts.map((account) => {
                                    const imports = getImportsForAccount(account.id);
                                    const category = account.category || 'BUSINESS';
                                    return (
                                        <TableRow key={account.id}>
                                            <TableCell className="font-medium">{account.name}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${category === 'BUSINESS'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                                    }`}>
                                                    {category === 'BUSINESS' ? (
                                                        <><Briefcase className="h-3 w-3" />ビジネス</>
                                                    ) : (
                                                        <><User className="h-3 w-3" />個人</>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {getBankTypeName(account.bank_type)}
                                                </span>
                                            </TableCell>
                                            <TableCell>{account.branch_name || '-'}</TableCell>
                                            <TableCell className="font-mono">{account.account_number || '-'}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                ¥{account.initial_balance.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                {imports.length === 0 ? (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {imports.slice(0, 3).map((imp) => (
                                                            <button
                                                                key={imp.id}
                                                                onClick={() => handleDownloadCsv(imp.id, imp.file_name)}
                                                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                                title={`${imp.records_count}件 - ${new Date(imp.created_at).toLocaleDateString('ja-JP')}`}
                                                            >
                                                                <FileDown className="h-3 w-3" />
                                                                <span className="truncate max-w-[120px]">{imp.file_name}</span>
                                                            </button>
                                                        ))}
                                                        {imports.length > 3 && (
                                                            <span className="text-xs text-gray-500">他{imports.length - 3}件</span>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {account.is_active ? (
                                                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">有効</span>
                                                ) : (
                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">無効</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteBankAccount(account.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}

                {/* Bank Transactions Table */}
                {viewType === 'bank_transactions' && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{filterAccountType === 'CREDIT_CARD' ? 'ご利用日' : '取引日'}</TableHead>
                                {filterAccountType === 'CREDIT_CARD' && <TableHead>データ処理日</TableHead>}
                                {filterAccountType === 'CREDIT_CARD' ? <TableHead>ご利用内容</TableHead> : null}
                                <TableHead>口座</TableHead>
                                {filterAccountType !== 'CREDIT_CARD' ? <TableHead>摘要</TableHead> : null}
                                <TableHead className="text-right">{filterAccountType === 'CREDIT_CARD' ? '金額' : '入金'}</TableHead>
                                {filterAccountType === 'CREDIT_CARD' ? (
                                    <>
                                        <TableHead className="text-right">海外金額</TableHead>
                                        <TableHead className="text-right">レート</TableHead>
                                    </>
                                ) : (
                                    <>
                                        <TableHead className="text-right">出金</TableHead>
                                        <TableHead className="text-right">残高</TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBankTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={filterAccountType === 'CREDIT_CARD' ? 7 : 6} className="text-center h-24">
                                        取引データが見つかりません。
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredBankTransactions.map((item) => {
                                    const accountInfo = getAccountWithCategory(item.bank_account_id);
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.transaction_date}</TableCell>
                                            {filterAccountType === 'CREDIT_CARD' && (
                                                <TableCell>{item.processing_date || '-'}</TableCell>
                                            )}
                                            {filterAccountType === 'CREDIT_CARD' && (
                                                <TableCell className="max-w-[250px] truncate" title={item.description}>
                                                    {item.description}
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${accountInfo.category === 'BUSINESS'
                                                        ? 'bg-blue-500'
                                                        : 'bg-purple-500'
                                                        }`} title={accountInfo.category === 'BUSINESS' ? 'ビジネス' : '個人'} />
                                                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                        {accountInfo.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            {filterAccountType !== 'CREDIT_CARD' && (
                                                <TableCell className="max-w-[250px] truncate" title={item.description}>
                                                    {item.description}
                                                </TableCell>
                                            )}

                                            {filterAccountType === 'CREDIT_CARD' ? (
                                                <>
                                                    <TableCell className="text-right font-mono text-red-600">
                                                        {item.withdrawal > 0 ? `¥${item.withdrawal.toLocaleString()}` : (item.deposit > 0 ? `(返金) ¥${item.deposit.toLocaleString()}` : '-')}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-gray-600">
                                                        {item.foreign_currency_amount ? item.foreign_currency_amount.toLocaleString() : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-gray-600">
                                                        {item.exchange_rate ? item.exchange_rate.toLocaleString() : '-'}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="text-right font-mono text-green-600">
                                                        {item.deposit > 0 ? `¥${item.deposit.toLocaleString()}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">
                                                        {item.withdrawal > 0 ? `¥${item.withdrawal.toLocaleString()}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {item.balance !== null ? `¥${item.balance.toLocaleString()}` : '-'}
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}

                {/* Documents Table */}
                {viewType === 'documents' && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        checked={filteredDocuments.length > 0 && selectedDocumentIds.size === filteredDocuments.length}
                                        onChange={handleToggleAllDocuments}
                                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                        title="全選択"
                                    />
                                </TableHead>
                                <TableHead>サムネイル</TableHead>
                                <TableHead>タイトル</TableHead>
                                <TableHead>種別</TableHead>
                                <TableHead>発行日</TableHead>
                                <TableHead>有効期限</TableHead>
                                <TableHead>登録日</TableHead>
                                <TableHead className="text-center">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDocuments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24">
                                        書類が登録されていません。
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredDocuments.map((doc) => {
                                    const fileUrl = getDocumentUrl(doc.file_path);
                                    const isPdf = doc.file_type === 'application/pdf' || doc.file_name.toLowerCase().endsWith('.pdf');
                                    const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                                    return (
                                        <TableRow key={doc.id} className={isExpired ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocumentIds.has(doc.id)}
                                                    onChange={() => handleToggleDocumentSelection(doc.id)}
                                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <a
                                                    href={fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="relative block w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
                                                >
                                                    {isPdf ? (
                                                        <iframe
                                                            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                                            className="w-full h-full border-0"
                                                            title={doc.title}
                                                        />
                                                    ) : (
                                                        <img
                                                            src={fileUrl}
                                                            alt={doc.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                    {/* Clickable overlay */}
                                                    <span className="absolute inset-0 z-10" />
                                                </a>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{doc.title}</div>
                                                {doc.description && (
                                                    <div className="text-xs text-gray-500 truncate max-w-[200px]" title={doc.description}>
                                                        {doc.description}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {doc.document_type}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {doc.issue_date || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {doc.expiry_date ? (
                                                    <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                                                        {doc.expiry_date}
                                                        {isExpired && <span className="ml-1 text-xs">(期限切れ)</span>}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-1">
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                                                        title="プレビュー"
                                                    >
                                                        <Eye className="h-4 w-4 text-blue-500" />
                                                    </a>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDownloadDocument(doc.file_path, doc.file_name)}
                                                        title="ダウンロード"
                                                    >
                                                        <Download className="h-4 w-4 text-green-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Edit Dialogs */}
            <EditExpenseDialog
                expense={editingExpense}
                open={isEditExpenseOpen}
                onOpenChange={setIsEditExpenseOpen}
                onUpdate={handleUpdateExpense}
            />
            <EditSaleDialog
                sale={editingSale}
                open={isEditSaleOpen}
                onOpenChange={setIsEditSaleOpen}
                onUpdate={handleUpdateSale}
            />
        </div>
    );
}

function DepartmentBadge({ department }: { department: string }) {
    const labels: Record<string, string> = {
        PHOTO: '写真事業',
        VIDEO: '動画事業',
        WEB: 'WEB制作',
        COMMON: '共通経費',
    };
    return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
            {labels[department] || department}
        </span>
    );
}

function ChannelBadge({ channel }: { channel: string | null }) {
    if (!channel) return <span className="text-gray-400">-</span>;

    const labels: Record<string, string> = {
        DIRECT: '直接',
        REFERRAL: '紹介',
        SNS: 'SNS',
        WEBSITE: 'Web',
        PLATFORM_KURASHI: 'くらし',
        PLATFORM_TOTTA: 'Totta',
        REPEAT: 'リピート',
        OTHER: 'その他',
    };
    return (
        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
            {labels[channel] || channel}
        </span>
    );
}
