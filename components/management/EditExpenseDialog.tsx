'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Expense } from '@/types/supabase';

const formSchema = z.object({
    transaction_date: z.string().min(1, '日付は必須です'),
    amount: z.coerce.number().min(1, '金額は0より大きい必要があります'),
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']),
    account_item: z.string().min(1, '勘定科目は必須です'),
    description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditExpenseDialogProps {
    expense: Expense | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: (updatedExpense: Expense) => void;
}

export function EditExpenseDialog({ expense, open, onOpenChange, onUpdate }: EditExpenseDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            transaction_date: '',
            amount: 0,
            department: 'COMMON',
            account_item: '',
            description: '',
        },
    });

    useEffect(() => {
        if (expense && open) {
            form.reset({
                transaction_date: expense.transaction_date,
                amount: expense.amount,
                department: expense.department as 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON',
                account_item: expense.account_item,
                description: expense.description || '',
            });
        }
    }, [expense, open, form]);

    const onSubmit = async (values: FormValues) => {
        if (!expense) return;

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('expenses')
                .update({
                    transaction_date: values.transaction_date,
                    amount: values.amount,
                    department: values.department,
                    account_item: values.account_item,
                    description: values.description || null,
                })
                .eq('id', expense.id)
                .select()
                .single();

            if (error) throw error;

            onUpdate(data);
            onOpenChange(false);
        } catch (error) {
            console.error('Update error:', error);
            alert('更新に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>経費を編集</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="transaction_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>取引日</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>金額</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-muted-foreground">¥</span>
                                                <Input type="number" {...field} className="pl-7" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="department"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>事業区分</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="事業区分を選択" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PHOTO">写真事業</SelectItem>
                                                <SelectItem value="VIDEO">動画事業</SelectItem>
                                                <SelectItem value="WEB">WEB制作</SelectItem>
                                                <SelectItem value="COMMON">共通経費</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="account_item"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>勘定科目</FormLabel>
                                        <FormControl>
                                            <Input placeholder="例: 消耗品費" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>摘要</FormLabel>
                                    <FormControl>
                                        <Input placeholder="店名、詳細など..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                キャンセル
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                保存
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
