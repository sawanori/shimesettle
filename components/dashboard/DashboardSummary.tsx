import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Building2 } from 'lucide-react';

interface SummaryProps {
    totalSales: number;
    totalExpenses: number;
    totalProfit: number;
    unpaidSales: number;
    businessBankBalance?: number;
}

export function DashboardSummary({
    totalSales,
    totalExpenses,
    totalProfit,
    unpaidSales,
    businessBankBalance,
}: SummaryProps) {
    const summaryItems = [
        {
            title: '総売上',
            value: totalSales,
            icon: TrendingUp,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            title: '総経費',
            value: totalExpenses,
            icon: TrendingDown,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            title: '粗利',
            value: totalProfit,
            icon: PiggyBank,
            color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600',
            bgColor: totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
        },
        {
            title: '未入金',
            value: unpaidSales,
            icon: Wallet,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
        },
        ...(businessBankBalance !== undefined ? [{
            title: '事業口座残高',
            value: businessBankBalance,
            icon: Building2,
            color: 'text-cyan-600',
            bgColor: 'bg-cyan-50',
        }] : []),
    ];

    return (
        <div className={`grid grid-cols-2 gap-4 ${summaryItems.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            {summaryItems.map((item) => (
                <Card key={item.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            {item.title}
                        </CardTitle>
                        <div className={`p-2 rounded-full ${item.bgColor}`}>
                            <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${item.color}`}>
                            ¥{item.value.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
