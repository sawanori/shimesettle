'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from '@/components/ui/dialog';
import { createClient } from '@/utils/supabase/client';
import { BankTransaction, Department } from '@/types/supabase';
import { Loader2, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ACCOUNT_ITEMS = [
    '消耗品費',
    '旅費交通費',
    '通信費',
    '地代家賃',
    '水道光熱費',
    '接待交際費',
    '会議費',
    '新聞図書費',
    '修繕費',
    '支払手数料',
    '外注工賃',
    '広告宣伝費',
    '租税公課',
    '研修費',
    '雑費',
];

const DEPARTMENTS: { value: Department; label: string }[] = [
    { value: 'PHOTO', label: '写真事業' },
    { value: 'VIDEO', label: '動画事業' },
    { value: 'WEB', label: 'Web制作事業' },
    { value: 'COMMON', label: '共通・その他' },
];

const formSchema = z.object({
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']),
    account_item: z.string().min(1, '勘定科目を選択してください'),
    description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TransactionToExpenseDialogProps {
    transaction: BankTransaction;
    onSuccess?: () => void;
}

export function TransactionToExpenseDialog({ transaction, onSuccess }: TransactionToExpenseDialogProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            department: 'COMMON',
            account_item: '',
            description: transaction.description,
        },
    });

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('認証エラー');

            // 1. 経費レコード作成
            const { data: expense, error: expenseError } = await supabase
                .from('expenses')
                .insert({
                    transaction_date: transaction.transaction_date,
                    amount: transaction.withdrawal, // 出金額を経費とする
                    department: data.department,
                    account_item: data.account_item,
                    description: data.description || transaction.description,
                    status: 'CONFIRMED', // 手動登録なので確認済みにする
                    user_id: user.id,
                })
                .select()
                .single();

            if (expenseError) throw expenseError;

            // 2. 取引レコードの更新（紐付け）
            const { error: transactionError } = await supabase
                .from('bank_transactions')
                .update({ linked_expense_id: expense.id })
                .eq('id', transaction.id);

            if (transactionError) throw transactionError;

            setOpen(false);
            router.refresh();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            alert('登録に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    // すでに経費化されているか、または入金（売上など）の場合はボタンを表示しない
    // ただし、クレジットカードのcsvインポートなどでは withdrawal がプラスで入る場合が多いが
    // bankCsvParser.ts では withdrawal/deposit に振り分けている。
    // クレジットカードの利用は withdrawal に入るはず。

    const isLinked = !!transaction.linked_expense_id;
    const isWithdrawal = transaction.withdrawal > 0;

    if (isLinked) {
        return (
            <div className="flex items-center text-green-600 text-xs">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                経費登録済
            </div>
        );
    }

    if (!isWithdrawal) {
        return <span className="text-gray-400">-</span>;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                    <ArrowRightLeft className="mr-2 h-3 w-3" />
                    経費にする
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>経費として登録</DialogTitle>
                    <DialogDescription>
                        銀行取引明細を経費として登録します。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4 text-sm border-y bg-gray-50 dark:bg-gray-900/50">
                    <div>
                        <span className="text-gray-500 block text-xs">取引日</span>
                        <span className="font-medium">{transaction.transaction_date}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs">金額</span>
                        <span className="font-medium">¥{transaction.withdrawal.toLocaleString()}</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-gray-500 block text-xs">元の摘要</span>
                        <span className="font-medium">{transaction.description}</span>
                    </div>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>事業区分</Label>
                        <Select
                            value={form.watch('department')}
                            onValueChange={(val: Department) => form.setValue('department', val)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DEPARTMENTS.map((dept) => (
                                    <SelectItem key={dept.value} value={dept.value}>
                                        {dept.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>勘定科目</Label>
                        <Select
                            value={form.watch('account_item')}
                            onValueChange={(val) => form.setValue('account_item', val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent>
                                {ACCOUNT_ITEMS.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.account_item && (
                            <p className="text-sm text-red-500">{form.formState.errors.account_item.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>摘要（経費としての説明）</Label>
                        <Input
                            {...form.register('description')}
                            placeholder={transaction.description}
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        登録する
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
