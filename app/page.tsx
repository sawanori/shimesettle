import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { SalesPieChart } from "@/components/dashboard/SalesPieChart";
import { RevenueBarChart } from "@/components/dashboard/RevenueBarChart";
import { Header } from "@/components/layout/Header";
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const fiscalYear = getCurrentFiscalYear();
    const data = await getDashboardData(fiscalYear);

    return (
        <>
            <Header userEmail={user?.email} />
            <div className="min-h-screen p-8 pb-20 pt-16 gap-16 sm:p-20 sm:pt-16 font-[family-name:var(--font-geist-sans)]">
                <main className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">NonTurn決算申告</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {getFiscalYearLabel(fiscalYear)}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
                        <div className="grid grid-cols-4 sm:flex gap-2 sm:gap-4 w-full sm:w-auto">
                            <Link href="/expenses">
                                <Button variant="outline" className="w-full sm:w-auto" size="sm">
                                    <Receipt className="sm:mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">経費登録</span>
                                    <span className="sm:hidden text-xs">経費</span>
                                </Button>
                            </Link>
                            <Link href="/sales">
                                <Button className="w-full sm:w-auto" size="sm">
                                    <TrendingUp className="sm:mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">売上登録</span>
                                    <span className="sm:hidden text-xs">売上</span>
                                </Button>
                            </Link>
                            <Link href="/bank">
                                <Button variant="outline" className="w-full sm:w-auto" size="sm">
                                    <Building2 className="sm:mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">銀行</span>
                                    <span className="sm:hidden text-xs">銀行</span>
                                </Button>
                            </Link>
                            <Link href="/documents">
                                <Button variant="outline" className="w-full sm:w-auto" size="sm">
                                    <FileCheck className="sm:mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">書類</span>
                                    <span className="sm:hidden text-xs">書類</span>
                                </Button>
                            </Link>
                        </div>
                        <div className="flex flex-col items-center sm:items-start">
                            <Link href="/management">
                                <Button variant="outline" className="bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-800" size="sm">
                                    <Settings className="mr-2 h-4 w-4" />
                                    管理コンソール
                                </Button>
                            </Link>
                            <span className="text-[10px] text-gray-500 mt-1">※税理士の方はこちらへ</span>
                        </div>
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
        </>
    );
}
