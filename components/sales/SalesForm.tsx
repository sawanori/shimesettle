'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { createClient } from '@/utils/supabase/client';
import { InvoiceUploader } from './InvoiceUploader';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
    transaction_date: z.string().min(1, '売上日は必須です'),
    amount: z.coerce.number().min(1, '金額は1円以上で入力してください'),
    client_name: z.string().min(1, '取引先名は必須です'),
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']),
    channel: z.enum(['DIRECT', 'REFERRAL', 'SNS', 'WEBSITE', 'PLATFORM_KURASHI', 'PLATFORM_TOTTA', 'REPEAT', 'OTHER']),
    status: z.enum(['UNPAID', 'PAID']),
    file_path: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// チャネルごとのデフォルト手数料率
const DEFAULT_FEE_RATES: Record<string, number> = {
    PLATFORM_KURASHI: 20,
    PLATFORM_TOTTA: 0,
};

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
};

export function SalesForm() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [feeType, setFeeType] = useState<'none' | 'rate' | 'amount'>('none');
    const [feeValue, setFeeValue] = useState<number>(0);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            transaction_date: '',
            amount: 0,
            client_name: '',
            department: 'COMMON',
            channel: 'DIRECT',
            status: 'UNPAID',
            file_path: '',
        },
    });

    const amount = form.watch('amount');
    const channel = form.watch('channel');

    // チャネル変更時にデフォルト手数料率を設定
    useEffect(() => {
        const defaultRate = DEFAULT_FEE_RATES[channel];
        if (defaultRate !== undefined && defaultRate > 0) {
            // くらしのマーケットなどプラットフォームの場合は自動で手数料を設定
            setFeeType('rate');
            setFeeValue(defaultRate);
        } else if (channel !== 'PLATFORM_KURASHI' && channel !== 'PLATFORM_TOTTA') {
            // プラットフォーム以外に変更した場合は手数料をリセット
            setFeeType('none');
            setFeeValue(0);
        }
    }, [channel]);

    // Set date on client side only to avoid hydration mismatch
    useEffect(() => {
        if (!form.getValues('transaction_date')) {
            form.setValue('transaction_date', new Date().toISOString().split('T')[0]);
        }
    }, [form]);

    // 手数料と手取りの計算
    const calculateFee = () => {
        if (feeType === 'none' || feeValue <= 0) {
            return { feeAmount: 0, feeRate: null, netAmount: amount };
        }
        if (feeType === 'rate') {
            const feeAmount = Math.round(amount * (feeValue / 100));
            return { feeAmount, feeRate: feeValue, netAmount: amount - feeAmount };
        }
        // feeType === 'amount'
        const feeRate = amount > 0 ? (feeValue / amount) * 100 : 0;
        return { feeAmount: feeValue, feeRate, netAmount: amount - feeValue };
    };

    const { feeAmount, feeRate, netAmount } = calculateFee();

    const onUploadComplete = async (url: string) => {
        form.setValue('file_path', url);

        // Auto analyze
        setIsAnalyzing(true);
        try {
            const response = await fetch('/api/analyze-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: url }),
            });

            if (!response.ok) throw new Error('解析に失敗しました');

            const data = await response.json();

            form.setValue('transaction_date', data.transaction_date || new Date().toISOString().split('T')[0]);
            form.setValue('amount', data.amount);
            form.setValue('client_name', data.client_name);
            if (data.department) {
                form.setValue('department', data.department);
            }

            // 摘要があればどこかにメモしたいが、現状Salesテーブルにはdescriptionがない。
            // 必要なら追加するが、今回は必須要件ではないのでスキップ。

        } catch (error) {
            console.error(error);
            alert('請求書の解析に失敗しました');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true);
        try {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('ログインしてください');
                return;
            }

            const { feeAmount, feeRate, netAmount } = calculateFee();

            const { error } = await supabase.from('sales').insert({
                transaction_date: values.transaction_date,
                amount: values.amount,
                fee_amount: feeAmount > 0 ? feeAmount : null,
                fee_rate: feeRate && feeRate > 0 ? feeRate : null,
                net_amount: netAmount,
                client_name: values.client_name,
                department: values.department,
                channel: values.channel,
                status: values.status,
                file_path: values.file_path || null,
                user_id: user.id,
            });

            if (error) throw error;

            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 3000);

            form.reset();
            setFeeType('none');
            setFeeValue(0);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('売上の登録に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            className="max-w-2xl mx-auto p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-white/10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <h2 className="text-xl font-semibold mb-6">売上登録</h2>

            {/* 請求書アップロード */}
            <div className="mb-6">
                <InvoiceUploader onUploadComplete={onUploadComplete} />
                {isAnalyzing && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center gap-2 text-primary mt-3 p-3 bg-primary/5 rounded-lg"
                    >
                        <Sparkles className="w-5 h-5 animate-pulse" />
                        <span className="text-sm font-medium">AIが請求書を解析中...</span>
                    </motion.div>
                )}
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <motion.div variants={itemVariants}>
                            <FormField
                                control={form.control}
                                name="transaction_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-muted-foreground">売上日</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-muted-foreground">金額 (円)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-muted-foreground">¥</span>
                                                <Input type="number" placeholder="0" {...field} className="pl-7 bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all font-mono text-lg" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </motion.div>
                    </div>

                    <motion.div variants={itemVariants}>
                        <FormField
                            control={form.control}
                            name="client_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-muted-foreground">取引先名</FormLabel>
                                    <FormControl>
                                        <Input placeholder="株式会社〇〇" {...field} className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </motion.div>

                    <div className="grid grid-cols-2 gap-6">
                        <motion.div variants={itemVariants}>
                            <FormField
                                control={form.control}
                                name="department"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-muted-foreground">事業区分</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800">
                                                    <SelectValue placeholder="事業を選択" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PHOTO">写真撮影</SelectItem>
                                                <SelectItem value="VIDEO">動画撮影</SelectItem>
                                                <SelectItem value="WEB">WEB開発</SelectItem>
                                                <SelectItem value="COMMON">共通</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <FormField
                                control={form.control}
                                name="channel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-muted-foreground">受注チャネル</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800">
                                                    <SelectValue placeholder="チャネルを選択" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="DIRECT">直接営業</SelectItem>
                                                <SelectItem value="REFERRAL">紹介</SelectItem>
                                                <SelectItem value="SNS">SNS</SelectItem>
                                                <SelectItem value="WEBSITE">ウェブサイト</SelectItem>
                                                <SelectItem value="PLATFORM_KURASHI">くらしのマーケット（手数料20%）</SelectItem>
                                                <SelectItem value="PLATFORM_TOTTA">Totta</SelectItem>
                                                <SelectItem value="REPEAT">リピート</SelectItem>
                                                <SelectItem value="OTHER">その他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </motion.div>
                    </div>

                    {/* 手数料入力セクション */}
                    <motion.div variants={itemVariants} className="border rounded-lg p-4 space-y-4 bg-gray-50/50 dark:bg-zinc-800/50 backdrop-blur-sm">
                        <FormLabel className="text-base font-medium">手数料（経費）</FormLabel>

                        <RadioGroup
                            value={feeType}
                            onValueChange={(value) => {
                                setFeeType(value as 'none' | 'rate' | 'amount');
                                if (value === 'none') setFeeValue(0);
                            }}
                            className="flex gap-6"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="none" id="fee-none" />
                                <Label htmlFor="fee-none" className="cursor-pointer">なし</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="rate" id="fee-rate" />
                                <Label htmlFor="fee-rate" className="cursor-pointer">％で指定</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="amount" id="fee-amount" />
                                <Label htmlFor="fee-amount" className="cursor-pointer">金額で指定</Label>
                            </div>
                        </RadioGroup>

                        {feeType !== 'none' && (
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    value={feeValue || ''}
                                    onChange={(e) => setFeeValue(Number(e.target.value))}
                                    placeholder={feeType === 'rate' ? '20' : '10000'}
                                    className="w-32 bg-white dark:bg-black/20"
                                    min={0}
                                    step={feeType === 'rate' ? 0.1 : 1}
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {feeType === 'rate' ? '%' : '円'}
                                </span>
                                {feeType === 'rate' && amount > 0 && (
                                    <span className="text-sm text-gray-500">
                                        = ¥{feeAmount.toLocaleString()}
                                    </span>
                                )}
                                {feeType === 'amount' && amount > 0 && feeRate !== null && (
                                    <span className="text-sm text-gray-500">
                                        = {feeRate.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        )}

                        {/* 手取り金額表示 */}
                        {amount > 0 && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">手取り金額</span>
                                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                                        ¥{netAmount.toLocaleString()}
                                    </span>
                                </div>
                                {feeAmount > 0 && (
                                    <div className="flex justify-between items-center text-sm text-gray-500 mt-1">
                                        <span>（手数料: ¥{feeAmount.toLocaleString()}）</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-muted-foreground">入金ステータス</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800">
                                                <SelectValue placeholder="ステータスを選択" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="UNPAID">未入金</SelectItem>
                                            <SelectItem value="PAID">入金済</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </motion.div>

                    <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                            type="submit"
                            className={`w-full h-12 text-lg font-medium transition-all duration-300 ${isSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : isSuccess ? (
                                <>
                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                    登録完了
                                </>
                            ) : (
                                '売上を登録'
                            )}
                        </Button>
                    </motion.div>
                </form>
            </Form>
        </motion.div>
    );
}
