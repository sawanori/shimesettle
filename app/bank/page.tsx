import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2 } from 'lucide-react';
import { BankPageClient } from '@/components/bank/BankPageClient';
import { BankAccount, BankTransaction } from '@/types/supabase';

async function getBankData() {
    const supabase = await createClient();

    const [accountsResult, transactionsResult] = await Promise.all([
        supabase
            .from('bank_accounts')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
        supabase
            .from('bank_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(500),
    ]);

    return {
        accounts: (accountsResult.data || []) as BankAccount[],
        transactions: (transactionsResult.data || []) as BankTransaction[],
    };
}

export default async function BankPage() {
    const { accounts, transactions } = await getBankData();

    // 口座ごとの最新残高を計算
    const accountBalances = accounts.map(account => {
        const accountTx = transactions.filter(t => t.bank_account_id === account.id);
        const latestTx = accountTx[0];
        const latestBalance = latestTx?.balance ?? account.initial_balance;
        return {
            ...account,
            currentBalance: latestBalance,
            transactionCount: accountTx.length,
        };
    });

    const totalBalance = accountBalances.reduce((sum, a) => sum + a.currentBalance, 0);

    return (
        <div className="min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center">
                            <Building2 className="mr-2 h-6 w-6" />
                            銀行口座管理
                        </h1>
                        <p className="text-sm text-gray-500">
                            銀行CSVをインポートして残高を管理
                        </p>
                    </div>
                </div>

                <BankPageClient
                    accounts={accounts}
                    transactions={transactions}
                    accountBalances={accountBalances}
                    totalBalance={totalBalance}
                />
            </main>
        </div>
    );
}
