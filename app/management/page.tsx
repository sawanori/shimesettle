import { createClient } from '@/utils/supabase/server';
import { ManagementTable } from '@/components/management/ManagementTable';
import Link from 'next/link';
import { BankTransaction } from '@/types/supabase';

export const dynamic = 'force-dynamic';

// Fetch all bank transactions with pagination to bypass 1000 row limit
async function fetchAllBankTransactions(supabase: Awaited<ReturnType<typeof createClient>>): Promise<BankTransaction[]> {
    const pageSize = 1000;
    let allTransactions: BankTransaction[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('bank_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching bank transactions:', error);
            break;
        }

        if (data && data.length > 0) {
            allTransactions = [...allTransactions, ...data];
            hasMore = data.length === pageSize;
            page++;
        } else {
            hasMore = false;
        }
    }

    return allTransactions;
}

export default async function ManagementPage() {
    const supabase = await createClient();

    // Fetch all data in parallel (except bank_transactions which needs pagination)
    const [expensesResult, salesResult, bankAccountsResult, csvImportsResult, documentsResult] = await Promise.all([
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
            .from('csv_imports')
            .select('*')
            .order('created_at', { ascending: false }),
        supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false }),
    ]);

    // Fetch bank transactions with pagination
    const bankTransactions = await fetchAllBankTransactions(supabase);

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
                        initialBankTransactions={bankTransactions}
                        initialCsvImports={csvImportsResult.data || []}
                        initialDocuments={documentsResult.data || []}
                    />
                </div>
            </main>
        </div>
    );
}
