'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SalesData {
    department: string;
    amount: number;
}

interface SalesPieChartProps {
    data: SalesData[];
}

const COLORS = {
    PHOTO: '#3b82f6',  // blue
    VIDEO: '#10b981',  // emerald
    WEB: '#f59e0b',    // amber
    COMMON: '#6b7280', // gray
};

const LABELS: Record<string, string> = {
    PHOTO: '写真撮影',
    VIDEO: '動画撮影',
    WEB: 'WEB開発',
    COMMON: '共通',
};

export function SalesPieChart({ data }: SalesPieChartProps) {
    const chartData = data.map(item => ({
        name: LABELS[item.department] || item.department,
        value: item.amount,
        department: item.department,
    }));

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
                売上データがありません
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                >
                    {chartData.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={COLORS[entry.department as keyof typeof COLORS] || '#8884d8'}
                        />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: number) => `¥${value.toLocaleString()}`}
                />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}
