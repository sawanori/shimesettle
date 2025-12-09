import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { SalesPieChart } from "@/components/dashboard/SalesPieChart";
import { RevenueBarChart } from "@/components/dashboard/RevenueBarChart";
import { Receipt, TrendingUp, Settings, Building2, FileCheck } from "lucide-react";
import { Department } from "@/types/supabase";
import { getCurrentFiscalYear, getFiscalYearRange, getFiscalYearLabel, isInFiscalYear } from "@/lib/fiscalYear";

interface DepartmentData {
    department: Department;
    sales: number;
    expenses: number;
    profit: number;
}

async function getDashboardData(fiscalYear: number) {
    const supabase = await createClient();
    const { start, end } = getFiscalYearRange(fiscalYear);

    const [salesResult, expensesResult, bankAccountsResult, bankTransactionsResult] = await Promise.all([
        supabase
            .from('sales')
            .select('*')
            .gte('transaction_date', start)
            .lte('transaction_date', end),
        supabase
            .from('expenses')
            .select('*')
            .gte('transaction_date', start)
            .lte('transaction_date', end),
        // ビジネス口座のみ取得
        supabase
            .from('bank_accounts')
            .select('id, initial_balance, category')
            .eq('is_active', true)
            .eq('category', 'BUSINESS'),
        // 全取引を取得（後でビジネス口座のみにフィルタ）
        supabase
            .from('bank_transactions')
            .select('bank_account_id, balance, transaction_date')
            .order('transaction_date', { ascending: false }),
    ]);

    const sales = salesResult.data || [];
    const expenses = expensesResult.data || [];
    const businessAccounts = bankAccountsResult.data || [];
    const bankTransactions = bankTransactionsResult.data || [];

    // ビジネス口座の最新残高を計算
    const businessAccountIds = new Set(businessAccounts.map(a => a.id));
    let businessBankBalance = 0;
    for (const account of businessAccounts) {
        const accountTx = bankTransactions.filter(t => t.bank_account_id === account.id);
        const latestTx = accountTx[0];
        const latestBalance = latestTx?.balance ?? account.initial_balance;
        businessBankBalance += latestBalance;
    }

    // 事業区分ごとの集計
    const departments: Department[] = ['PHOTO', 'VIDEO', 'WEB', 'COMMON'];
    const departmentData: DepartmentData[] = departments.map(dept => {
        const deptSales = sales
            .filter(s => s.department === dept)
            .reduce((sum, s) => sum + s.amount, 0);
        const deptExpenses = expenses
            .filter(e => e.department === dept)
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            department: dept,
            sales: deptSales,
            expenses: deptExpenses,
            profit: deptSales - deptExpenses,
        };
    });

    // 総計
    const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalProfit = totalSales - totalExpenses;
    const unpaidSales = sales
        .filter(s => s.status === 'UNPAID')
        .reduce((sum, s) => sum + s.amount, 0);

    // 売上構成比用データ
    const salesByDepartment = departmentData
        .filter(d => d.sales > 0)
        .map(d => ({
            department: d.department,
            amount: d.sales,
        }));

    return {
        totalSales,
        totalExpenses,
        totalProfit,
        unpaidSales,
        departmentData,
        salesByDepartment,
        businessBankBalance,
    };
}

export default async function Home() {
    const fiscalYear = getCurrentFiscalYear();
    const data = await getDashboardData(fiscalYear);

    return (
        <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">NonTurn決算申告</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {getFiscalYearLabel(fiscalYear)}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/expenses">
                            <Button variant="outline">
                                <Receipt className="mr-2 h-4 w-4" />
                                経費登録
                            </Button>
                        </Link>
                        <Link href="/sales">
                            <Button>
                                <TrendingUp className="mr-2 h-4 w-4" />
                                売上登録
                            </Button>
                        </Link>
                        <Link href="/bank">
                            <Button variant="outline">
                                <Building2 className="mr-2 h-4 w-4" />
                                銀行
                            </Button>
                        </Link>
                        <Link href="/documents">
                            <Button variant="outline">
                                <FileCheck className="mr-2 h-4 w-4" />
                                書類
                            </Button>
                        </Link>
                        <Link href="/management">
                            <Button variant="ghost">
                                <Settings className="mr-2 h-4 w-4" />
                                管理
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* サマリーカード */}
                <DashboardSummary
                    totalSales={data.totalSales}
                    totalExpenses={data.totalExpenses}
                    totalProfit={data.totalProfit}
                    unpaidSales={data.unpaidSales}
                    businessBankBalance={data.businessBankBalance}
                />

                {/* グラフエリア */}
                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>事業別売上構成比</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SalesPieChart data={data.salesByDepartment} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>事業別収支</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RevenueBarChart data={data.departmentData} />
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
