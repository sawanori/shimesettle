'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BankAccountForm } from './BankAccountForm';
import { CsvImportDialog } from './CsvImportDialog';
import { TransactionTable } from './TransactionTable';
import { BankAccount, BankTransaction, AccountCategory } from '@/types/supabase';
import { getBankTypeName } from '@/lib/bankCsvParser';
import { Info, Briefcase, User } from 'lucide-react';

interface AccountWithBalance extends BankAccount {
    currentBalance: number;
    transactionCount: number;
}

interface BankPageClientProps {
    accounts: BankAccount[];
    transactions: BankTransaction[];
    accountBalances: AccountWithBalance[];
    totalBalance: number;
}

export function BankPageClient({
    accounts,
    transactions,
    accountBalances,
    totalBalance,
}: BankPageClientProps) {
    const router = useRouter();
    const [activeCategory, setActiveCategory] = useState<AccountCategory>('BUSINESS');

    const handleRefresh = () => {
        router.refresh();
    };

    // カテゴリ別にフィルタリング
    const filteredAccounts = accountBalances.filter(
        (a) => (a.category || 'BUSINESS') === activeCategory
    );
    const filteredTransactions = transactions.filter((t) => {
        const account = accounts.find((a) => a.id === t.bank_account_id);
        return (account?.category || 'BUSINESS') === activeCategory;
    });
    const filteredTotalBalance = filteredAccounts.reduce(
        (sum, a) => sum + a.currentBalance,
        0
    );

    // ビジネス口座のみの合計（サマリー表示用）
    const businessAccounts = accountBalances.filter(
        (a) => (a.category || 'BUSINESS') === 'BUSINESS'
    );
    const businessTotalBalance = businessAccounts.reduce(
        (sum, a) => sum + a.currentBalance,
        0
    );

    return (
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as AccountCategory)}>
            <div className="flex items-center justify-between mb-4">
                <TabsList>
                    <TabsTrigger value="BUSINESS" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        ビジネス口座
                    </TabsTrigger>
                    <TabsTrigger value="PERSONAL" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        個人口座
                    </TabsTrigger>
                </TabsList>
                <BankAccountForm onSuccess={handleRefresh} defaultCategory={activeCategory} />
            </div>

            <TabsContent value="BUSINESS" className="space-y-6">
                <AccountsView
                    accounts={filteredAccounts}
                    transactions={filteredTransactions}
                    totalBalance={filteredTotalBalance}
                    allAccounts={accounts.filter((a) => (a.category || 'BUSINESS') === 'BUSINESS')}
                    onRefresh={handleRefresh}
                    category="BUSINESS"
                />
            </TabsContent>

            <TabsContent value="PERSONAL" className="space-y-6">
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                        個人口座はダッシュボードの集計には含まれません。税理士確認用としてご利用ください。
                    </AlertDescription>
                </Alert>
                <AccountsView
                    accounts={filteredAccounts}
                    transactions={filteredTransactions}
                    totalBalance={filteredTotalBalance}
                    allAccounts={accounts.filter((a) => a.category === 'PERSONAL')}
                    onRefresh={handleRefresh}
                    category="PERSONAL"
                />
            </TabsContent>
        </Tabs>
    );
}

// 口座表示コンポーネント（共通化）
interface AccountsViewProps {
    accounts: AccountWithBalance[];
    transactions: BankTransaction[];
    totalBalance: number;
    allAccounts: BankAccount[];
    onRefresh: () => void;
    category: AccountCategory;
}

function AccountsView({
    accounts,
    transactions,
    totalBalance,
    allAccounts,
    onRefresh,
    category,
}: AccountsViewProps) {
    if (accounts.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 text-center text-gray-500">
                    <p>{category === 'BUSINESS' ? 'ビジネス' : '個人'}口座がまだ登録されていません。</p>
                    <p className="text-sm mt-1">「口座を追加」ボタンから追加してください。</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* 残高サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className={`md:col-span-1 bg-gradient-to-br ${
                    category === 'BUSINESS'
                        ? 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
                        : 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20'
                }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className={`text-sm font-medium ${
                            category === 'BUSINESS'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-purple-600 dark:text-purple-400'
                        }`}>
                            {category === 'BUSINESS' ? 'ビジネス' : '個人'}合計残高
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ¥{totalBalance.toLocaleString()}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {accounts.length}口座
                        </p>
                    </CardContent>
                </Card>

                {accounts.slice(0, 3).map((account) => (
                    <Card key={account.id}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-sm font-medium">
                                    {account.name}
                                </CardTitle>
                                <CsvImportDialog
                                    account={account}
                                    onSuccess={onRefresh}
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                {getBankTypeName(account.bank_type)}
                                {account.branch_name && ` ${account.branch_name}`}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold">
                                ¥{account.currentBalance.toLocaleString()}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {account.transactionCount}件の取引
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* 口座一覧（4つ以上ある場合） */}
            {accounts.length > 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle>その他の口座</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {accounts.slice(3).map((account) => (
                                <div key={account.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                    <div>
                                        <span className="font-medium">{account.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">
                                            {getBankTypeName(account.bank_type)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono">
                                            ¥{account.currentBalance.toLocaleString()}
                                        </span>
                                        <CsvImportDialog
                                            account={account}
                                            onSuccess={onRefresh}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 取引一覧 */}
            <Card>
                <CardHeader>
                    <CardTitle>取引履歴</CardTitle>
                </CardHeader>
                <CardContent>
                    <TransactionTable
                        transactions={transactions}
                        accounts={allAccounts}
                    />
                </CardContent>
            </Card>
        </>
    );
}

interface BankAccountFormWrapperProps {
    defaultCategory?: AccountCategory;
}

export function BankAccountFormWrapper({ defaultCategory = 'BUSINESS' }: BankAccountFormWrapperProps) {
    const router = useRouter();

    return <BankAccountForm onSuccess={() => router.refresh()} defaultCategory={defaultCategory} />;
}
