import { createClient } from '@/utils/supabase/server';
import { ManagementTable } from '@/components/management/ManagementTable';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ManagementPage() {
    const supabase = await createClient();

    // Fetch all data in parallel
    const [expensesResult, salesResult, bankAccountsResult, bankTransactionsResult, csvImportsResult] = await Promise.all([
        supabase
            .from('expenses')
            .select('*')
            .order('transaction_date', { ascending: false }),
        supabase
            .from('sales')
            .select('*')
            .order('transaction_date', { ascending: false }),
        supabase
            .from('bank_accounts')
            .select('*')
            .order('created_at', { ascending: false }),
        supabase
            .from('bank_transactions')
            .select('*')
            .order('transaction_date', { ascending: false }),
        supabase
            .from('csv_imports')
            .select('*')
            .order('created_at', { ascending: false }),
    ]);

    return (
        <div className="min-h-screen p-4 sm:p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-4 sm:gap-8 row-start-2 w-full max-w-6xl mx-auto">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl sm:text-3xl font-bold">管理コンソール</h1>
                    <Link
                        href="/"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        ダッシュボードに戻る
                    </Link>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border">
                    <ManagementTable
                        initialExpenses={expensesResult.data || []}
                        initialSales={salesResult.data || []}
                        initialBankAccounts={bankAccountsResult.data || []}
                        initialBankTransactions={bankTransactionsResult.data || []}
                        initialCsvImports={csvImportsResult.data || []}
                    />
                </div>
            </main>
        </div>
    );
}
