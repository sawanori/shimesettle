'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface RevenueData {
    department: string;
    sales: number;
    expenses: number;
    profit: number;
}

interface RevenueBarChartProps {
    data: RevenueData[];
}

const LABELS: Record<string, string> = {
    PHOTO: '写真撮影',
    VIDEO: '動画撮影',
    WEB: 'WEB開発',
    COMMON: '共通',
};

export function RevenueBarChart({ data }: RevenueBarChartProps) {
    const chartData = data.map(item => ({
        name: LABELS[item.department] || item.department,
        売上: item.sales,
        経費: item.expenses,
        粗利: item.profit,
    }));

    const hasData = chartData.some(item => item.売上 > 0 || item.経費 > 0);

    if (!hasData) {
        return (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
                収支データがありません
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={chartData}
                margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                    tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                    formatter={(value: number) => `¥${value.toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="売上" fill="#3b82f6" />
                <Bar dataKey="経費" fill="#ef4444" />
                <Bar dataKey="粗利" fill="#10b981" />
            </BarChart>
        </ResponsiveContainer>
    );
}
