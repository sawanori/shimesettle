'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BankAccountFormWrapper } from '@/components/bank/BankAccountForm';
import { CsvImportDialog } from '@/components/bank/CsvImportDialog';
import { TransactionTable } from '@/components/bank/TransactionTable';
import { BankAccount, BankTransaction, AccountCategory, BankType, AccountType } from '@/types/supabase';
import { getBankTypeName } from '@/lib/bankCsvParser';
import { CreditCard, Wallet } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<AccountCategory>('BUSINESS');

    const handleRefresh = () => {
        router.refresh();
    };

    // カテゴリ別にフィルタリング
    const filteredAccounts = accountBalances.filter(
        (a) => (a.category || 'BUSINESS') === activeTab
    );
    const filteredTransactions = transactions.filter((t) => {
        const account = accounts.find((a) => a.id === t.bank_account_id);
        return (account?.category || 'BUSINESS') === activeTab;
    });
    const filteredTotalBalance = filteredAccounts.reduce(
        (sum, a) => sum + a.currentBalance,
        0
    );

    return (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccountCategory)}>
            <div className="flex items-center justify-between mb-4">
                <TabsList className="grid w-[400px] grid-cols-2">
                    <TabsTrigger value="BUSINESS" className="flex items-center gap-2">
                        事業用口座
                    </TabsTrigger>
                    <TabsTrigger value="PERSONAL" className="flex items-center gap-2">
                        個人用口座
                    </TabsTrigger>
                </TabsList>
                <BankAccountFormWrapper onSuccess={handleRefresh} defaultCategory={activeTab} />
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
    const [transactionFilter, setTransactionFilter] = useState<AccountType>('BANK');
    const CARD_TYPES: BankType[] = ['RAKUTEN_CARD', 'AMEX', 'OTHER_CARD'];

    // account_type に基づいて分離
    const bankAccounts = accounts.filter(a => a.account_type === 'BANK');
    const creditCards = accounts.filter(a => a.account_type === 'CREDIT_CARD');

    return (
        <div className="space-y-8">
            {/* 資産サマリー */}
            <Card className={`bg-gradient-to-br ${category === 'BUSINESS'
                ? 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
                : 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20'
                }`}>
                <CardHeader className="pb-2">
                    <CardTitle className={`text-sm font-medium ${category === 'BUSINESS'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-purple-600 dark:text-purple-400'
                        }`}>
                        {category === 'BUSINESS' ? 'ビジネス' : '個人'}資産合計
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">
                        ¥{totalBalance.toLocaleString()}
                    </div>
                </CardContent>
            </Card>

            {/* 銀行口座セクション */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    銀行口座
                </h3>
                {bankAccounts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bankAccounts.map((account) => (
                            <AccountCard key={account.id} account={account} onRefresh={onRefresh} />
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed bg-gray-50/50 dark:bg-gray-900/20">
                        <CardContent className="py-8 text-center text-gray-500">
                            <p className="text-sm">銀行口座が登録されていません</p>
                            <p className="text-xs mt-1 text-gray-400">右上の「追加」ボタンから登録できます</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* クレジットカードセクション (常時表示) */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    クレジットカード
                </h3>
                {creditCards.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {creditCards.map((card) => (
                            <AccountCard key={card.id} account={card} onRefresh={onRefresh} isCard />
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed bg-gray-50/50 dark:bg-gray-900/20">
                        <CardContent className="py-8 text-center text-gray-500">
                            <p className="text-sm">クレジットカードが登録されていません</p>
                            <p className="text-xs mt-1 text-gray-400">右上の「追加」ボタンから登録できます</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* 取引履歴 */}
            <div>
                <h3 className="text-lg font-semibold mb-4">取引履歴</h3>
                <Card>
                    <Tabs value={transactionFilter} onValueChange={(v) => setTransactionFilter(v as AccountType)}>
                        <div className="border-b px-4 pt-2">
                            <TabsList className="w-full justify-start h-auto p-0 bg-transparent">
                                <TabsTrigger
                                    value="BANK"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-2 px-4"
                                >
                                    銀行取引
                                </TabsTrigger>
                                <TabsTrigger
                                    value="CREDIT_CARD"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-2 px-4"
                                >
                                    カード利用
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        <CardContent className="pt-6">
                            <TabsContent value="BANK" className="mt-0">
                                <TransactionTable
                                    transactions={transactions}
                                    accounts={allAccounts}
                                    filterType="BANK"
                                />
                            </TabsContent>
                            <TabsContent value="CREDIT_CARD" className="mt-0">
                                <TransactionTable
                                    transactions={transactions}
                                    accounts={allAccounts}
                                    filterType="CREDIT_CARD"
                                />
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
}

function AccountCard({ account, onRefresh, isCard = false }: { account: AccountWithBalance, onRefresh: () => void, isCard?: boolean }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {isCard ? <CreditCard className="h-4 w-4 text-gray-500" /> : <Wallet className="h-4 w-4 text-gray-500" />}
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
                <div className={`text-xl font-bold ${account.currentBalance < 0 ? 'text-red-500' : ''}`}>
                    ¥{account.currentBalance.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {account.transactionCount}件の取引
                </p>
            </CardContent>
        </Card>
    );
}

function AccountRow({ account, onRefresh }: { account: AccountWithBalance, onRefresh: () => void }) {
    return (
        <div className="flex justify-between items-center py-2 border-b last:border-0">
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
    );
}
