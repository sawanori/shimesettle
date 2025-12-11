'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/utils/supabase/client';
import { ReceiptUploader } from './ReceiptUploader';
import { SingleReceiptUploader } from './SingleReceiptUploader';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Upload, FileText, Pencil, X, ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

// ============ Single Form Schema ============
const formSchema = z.object({
    transaction_date: z.string().optional(),
    amount: z.coerce.number().min(0),
    department: z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']).optional(),
    account_item: z.string().optional(),
    description: z.string().optional(),
    file_path: z.string().optional(),
    folder_number: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ============ Batch Upload Types ============
type ProcessingStep = 'select' | 'processing' | 'review' | 'registering' | 'complete';

interface ExpenseData {
    id: string;
    file: File;
    fileUrl: string | null;
    previewUrl: string | null;
    transaction_date: string;
    amount: number;
    department: 'PHOTO' | 'VIDEO' | 'WEB' | 'COMMON';
    account_item: string;
    description: string;
    folder_number: string;
    status: 'pending' | 'analyzing' | 'analyzed' | 'error' | 'registering' | 'registered';
    error?: string;
}

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
};

export function ExpenseForm() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

    // ============ Single Form State ============
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            transaction_date: '',
            amount: 0,
            department: 'COMMON',
            account_item: '',
            description: '',
            file_path: '',
            folder_number: '',
        },
    });

    useEffect(() => {
        if (!form.getValues('transaction_date')) {
            form.setValue('transaction_date', new Date().toISOString().split('T')[0]);
        }
    }, [form]);

    const onSingleUploadComplete = async (url: string) => {
        form.setValue('file_path', url);

        // Auto analyze
        setIsAnalyzing(true);
        try {
            const response = await fetch('/api/analyze-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: url }),
            });

            if (!response.ok) throw new Error('解析に失敗しました');

            const data = await response.json();

            form.setValue('transaction_date', data.transaction_date || new Date().toISOString().split('T')[0]);
            form.setValue('amount', data.amount);
            form.setValue('department', data.department);
            form.setValue('account_item', data.account_item);

            const desc = data.vendor_name ? `${data.vendor_name} / ${data.description || ''}` : data.description;
            form.setValue('description', desc || '');

        } catch (error) {
            console.error(error);
            alert('領収書の解析に失敗しました');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const onSingleSubmit = async (values: FormValues) => {
        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('ログインしてください');
                return;
            }

            const { error } = await supabase.from('expenses').insert({
                transaction_date: values.transaction_date || new Date().toISOString().split('T')[0],
                amount: values.amount || 0,
                department: values.department || 'COMMON',
                account_item: values.account_item || '未設定',
                description: values.description || null,
                file_path: values.file_path || null,
                folder_number: values.folder_number || null,
                user_id: user.id,
                status: 'UNCONFIRMED',
                ai_check_status: 'PENDING',
            } as any);

            if (error) throw error;

            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 3000);
            form.reset();
            form.setValue('transaction_date', new Date().toISOString().split('T')[0]);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('経費の登録に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============ Batch Upload State ============
    const [step, setStep] = useState<ProcessingStep>('select');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [expenses, setExpenses] = useState<ExpenseData[]>([]);
    const [currentProcessing, setCurrentProcessing] = useState(0);
    const [totalToProcess, setTotalToProcess] = useState(0);
    const [processingMessage, setProcessingMessage] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleFilesSelected = useCallback((files: File[]) => {
        setSelectedFiles(files);
    }, []);

    const startProcessing = async () => {
        if (selectedFiles.length === 0) return;

        setStep('processing');
        setTotalToProcess(selectedFiles.length * 2);
        setCurrentProcessing(0);

        const supabase = createClient();
        const newExpenses: ExpenseData[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const id = Math.random().toString(36).substring(2);
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

            // フォルダー番号をファイル名から抽出（例: "001_receipt.jpg" -> "001"）
            const folderMatch = file.name.match(/^(\d+)/);
            const folderNumber = folderMatch ? folderMatch[1] : '';

            const expense: ExpenseData = {
                id,
                file,
                fileUrl: null,
                previewUrl,
                transaction_date: new Date().toISOString().split('T')[0],
                amount: 0,
                department: 'COMMON',
                account_item: '',
                description: '',
                folder_number: folderNumber,
                status: 'pending',
            };
            newExpenses.push(expense);
            setExpenses([...newExpenses]);

            setProcessingMessage(`アップロード中... (${i + 1}/${selectedFiles.length})`);
            expense.status = 'analyzing';
            setExpenses([...newExpenses]);

            try {
                const fileExt = file.name.split('.').pop();
                const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('receipts')
                    .upload(uniqueName, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('receipts')
                    .getPublicUrl(uniqueName);

                expense.fileUrl = publicUrl;
                setCurrentProcessing((i * 2) + 1);

                setProcessingMessage(`AI解析中... (${i + 1}/${selectedFiles.length})`);

                // AI解析（最大3回リトライ）
                let analyzeSuccess = false;
                let lastError: Error | null = null;

                for (let retry = 0; retry < 3 && !analyzeSuccess; retry++) {
                    if (retry > 0) {
                        setProcessingMessage(`AI解析中... (${i + 1}/${selectedFiles.length}) - リトライ ${retry + 1}/3`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // リトライ前に1秒待機
                    }

                    try {
                        const response = await fetch('/api/analyze-receipt', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageUrl: publicUrl }),
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`AI解析に失敗しました: ${errorText}`);
                        }

                        const data = await response.json();

                        expense.transaction_date = data.transaction_date || new Date().toISOString().split('T')[0];
                        expense.amount = data.amount || 0;
                        expense.department = data.department || 'COMMON';
                        expense.account_item = data.account_item || '';
                        expense.description = data.vendor_name
                            ? `${data.vendor_name}${data.description ? ' / ' + data.description : ''}`
                            : data.description || '';
                        expense.status = 'analyzed';
                        analyzeSuccess = true;
                    } catch (retryError) {
                        lastError = retryError instanceof Error ? retryError : new Error('処理に失敗しました');
                        console.error(`AI解析リトライ ${retry + 1}/3 失敗:`, retryError);
                    }
                }

                if (!analyzeSuccess) {
                    throw lastError || new Error('AI解析に失敗しました');
                }

            } catch (error) {
                console.error('Processing error:', error);
                expense.status = 'error';
                expense.error = error instanceof Error ? error.message : '処理に失敗しました';
            }

            setCurrentProcessing((i + 1) * 2);
            setExpenses([...newExpenses]);

            if (i < selectedFiles.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        setStep('review');
    };

    const updateExpense = (id: string, field: keyof ExpenseData, value: any) => {
        setExpenses(prev => prev.map(e =>
            e.id === id ? { ...e, [field]: value } : e
        ));
    };

    const removeExpense = (id: string) => {
        const newExpenses = expenses.filter(e => e.id !== id);
        setExpenses(newExpenses);
        if (newExpenses.length === 0) {
            resetBatchForm();
        }
    };

    const startRegistering = async () => {
        const validExpenses = expenses.filter(e => e.status === 'analyzed' && e.amount > 0);
        if (validExpenses.length === 0) {
            alert('登録可能な経費がありません');
            return;
        }

        setStep('registering');
        setTotalToProcess(validExpenses.length);
        setCurrentProcessing(0);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert('ログインしてください');
            setStep('review');
            return;
        }

        for (let i = 0; i < validExpenses.length; i++) {
            const expense = validExpenses[i];
            setProcessingMessage(`登録中... (${i + 1}/${validExpenses.length})`);

            const expenseIndex = expenses.findIndex(e => e.id === expense.id);
            if (expenseIndex !== -1) {
                expenses[expenseIndex].status = 'registering';
                setExpenses([...expenses]);
            }

            try {
                const { error } = await supabase.from('expenses').insert({
                    transaction_date: expense.transaction_date,
                    amount: expense.amount,
                    department: expense.department,
                    account_item: expense.account_item,
                    description: expense.description || null,
                    file_path: expense.fileUrl,
                    folder_number: expense.folder_number || null,
                    user_id: user.id,
                    status: 'UNCONFIRMED',
                    ai_check_status: 'PENDING',
                });

                if (error) throw error;

                if (expenseIndex !== -1) {
                    expenses[expenseIndex].status = 'registered';
                    setExpenses([...expenses]);
                }
            } catch (error) {
                console.error('Registration error:', error);
                if (expenseIndex !== -1) {
                    expenses[expenseIndex].status = 'error';
                    expenses[expenseIndex].error = '登録に失敗しました';
                    setExpenses([...expenses]);
                }
            }

            setCurrentProcessing(i + 1);

            if (i < validExpenses.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        setStep('complete');
        router.refresh();
    };

    const resetBatchForm = () => {
        setStep('select');
        setSelectedFiles([]);
        setExpenses([]);
        setCurrentProcessing(0);
        setTotalToProcess(0);
        setProcessingMessage('');
        setEditingId(null);
    };

    const progressPercent = totalToProcess > 0 ? (currentProcessing / totalToProcess) * 100 : 0;
    const analyzedCount = expenses.filter(e => e.status === 'analyzed').length;
    const errorCount = expenses.filter(e => e.status === 'error').length;
    const registeredCount = expenses.filter(e => e.status === 'registered').length;

    return (
        <motion.div
            className="max-w-2xl mx-auto p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-white/10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'batch')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="single" className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        1枚ずつ登録
                    </TabsTrigger>
                    <TabsTrigger value="batch" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        一括登録
                    </TabsTrigger>
                </TabsList>

                {/* ============ Single Upload Tab (Original) ============ */}
                <TabsContent value="single" forceMount className={activeTab !== 'single' ? 'hidden' : ''}>
                    <div className="mb-8">
                        <SingleReceiptUploader onUploadComplete={onSingleUploadComplete} />
                        {isAnalyzing && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="flex items-center gap-2 text-primary mt-3 p-3 bg-primary/5 rounded-lg"
                            >
                                <Sparkles className="w-5 h-5 animate-pulse" />
                                <span className="text-sm font-medium">AIが領収書を解析中...</span>
                            </motion.div>
                        )}
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSingleSubmit)} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <motion.div variants={itemVariants}>
                                    <FormField
                                        control={form.control}
                                        name="transaction_date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-muted-foreground">取引日</FormLabel>
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
                                                <FormLabel className="text-muted-foreground">金額</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-muted-foreground">¥</span>
                                                        <Input type="number" {...field} className="pl-7 bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all font-mono text-lg" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <motion.div variants={itemVariants}>
                                    <FormField
                                        control={form.control}
                                        name="department"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-muted-foreground">事業区分</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800">
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
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <FormField
                                        control={form.control}
                                        name="account_item"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-muted-foreground">勘定科目</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="例: 消耗品費" {...field} className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>
                            </div>

                            <div className="grid grid-cols-4 gap-6">
                                <motion.div variants={itemVariants} className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="folder_number"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-muted-foreground">No.</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="001" {...field} className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all font-mono" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>
                                <motion.div variants={itemVariants} className="col-span-3">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-muted-foreground">摘要</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="店名、詳細など..." {...field} className="bg-white/50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-primary/20 transition-all" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>
                            </div>

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
                                        '経費を登録'
                                    )}
                                </Button>
                            </motion.div>
                        </form>
                    </Form>
                </TabsContent>

                {/* ============ Batch Upload Tab ============ */}
                <TabsContent value="batch" forceMount className={activeTab !== 'batch' ? 'hidden' : ''}>
                    <AnimatePresence mode="wait">
                        {step === 'select' && (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="mb-6">
                                    <ReceiptUploader onFilesSelected={handleFilesSelected} />
                                </div>

                                <Button
                                    onClick={startProcessing}
                                    disabled={selectedFiles.length === 0}
                                    className="w-full h-12 text-lg font-medium"
                                >
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    {selectedFiles.length > 0
                                        ? `${selectedFiles.length}枚の領収書を解析する`
                                        : '領収書を選択してください'}
                                </Button>
                            </motion.div>
                        )}

                        {step === 'processing' && (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                <div className="text-center">
                                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">{processingMessage}</h3>
                                    <p className="text-sm text-gray-500">しばらくお待ちください...</p>
                                </div>

                                <div className="space-y-2">
                                    <Progress value={progressPercent} className="h-3" />
                                    <p className="text-sm text-center text-gray-500">
                                        {Math.round(progressPercent)}% 完了
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {expenses.map((expense) => (
                                        <div
                                            key={expense.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${expense.status === 'analyzing' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
                                                expense.status === 'analyzed' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                                                    expense.status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                                                        'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                                {expense.previewUrl ? (
                                                    <img src={expense.previewUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <FileText className="w-full h-full p-2 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{expense.file.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {expense.status === 'pending' && '待機中'}
                                                    {expense.status === 'analyzing' && 'AI解析中...'}
                                                    {expense.status === 'analyzed' && `¥${expense.amount.toLocaleString()}`}
                                                    {expense.status === 'error' && expense.error}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {expense.status === 'analyzing' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                                                {expense.status === 'analyzed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                                {expense.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {step === 'review' && (
                            <motion.div
                                key="review"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">解析結果の確認</h3>
                                    <div className="text-sm text-gray-500">
                                        {analyzedCount}件成功
                                        {errorCount > 0 && <span className="text-red-500 ml-2">{errorCount}件エラー</span>}
                                    </div>
                                </div>

                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                    {expenses.map((expense) => (
                                        <div
                                            key={expense.id}
                                            className={`p-4 rounded-lg border ${expense.status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                                }`}
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-20 h-20 rounded overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                                                    {expense.previewUrl ? (
                                                        <img src={expense.previewUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText className="w-full h-full p-4 text-gray-400" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-2">
                                                    {expense.status === 'error' ? (
                                                        <div className="text-red-600">
                                                            <p className="font-medium">エラー</p>
                                                            <p className="text-sm">{expense.error}</p>
                                                        </div>
                                                    ) : editingId === expense.id ? (
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <Label className="text-xs">日付</Label>
                                                                    <Input
                                                                        type="date"
                                                                        value={expense.transaction_date}
                                                                        onChange={(e) => updateExpense(expense.id, 'transaction_date', e.target.value)}
                                                                        className="h-8 text-sm"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">金額</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={expense.amount}
                                                                        onChange={(e) => updateExpense(expense.id, 'amount', Number(e.target.value))}
                                                                        className="h-8 text-sm"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <Label className="text-xs">事業区分</Label>
                                                                    <Select
                                                                        value={expense.department}
                                                                        onValueChange={(v) => updateExpense(expense.id, 'department', v)}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-sm">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="PHOTO">写真事業</SelectItem>
                                                                            <SelectItem value="VIDEO">動画事業</SelectItem>
                                                                            <SelectItem value="WEB">WEB制作</SelectItem>
                                                                            <SelectItem value="COMMON">共通経費</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">勘定科目</Label>
                                                                    <Input
                                                                        value={expense.account_item}
                                                                        onChange={(e) => updateExpense(expense.id, 'account_item', e.target.value)}
                                                                        className="h-8 text-sm"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                <div className="col-span-1">
                                                                    <Label className="text-xs">No.</Label>
                                                                    <Input
                                                                        value={expense.folder_number}
                                                                        onChange={(e) => updateExpense(expense.id, 'folder_number', e.target.value)}
                                                                        className="h-8 text-sm font-mono"
                                                                        placeholder="001"
                                                                    />
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <Label className="text-xs">摘要</Label>
                                                                    <Input
                                                                        value={expense.description}
                                                                        onChange={(e) => updateExpense(expense.id, 'description', e.target.value)}
                                                                        className="h-8 text-sm"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => setEditingId(null)}
                                                                className="mt-2"
                                                            >
                                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                完了
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    {expense.folder_number && (
                                                                        <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded mr-2">
                                                                            No.{expense.folder_number}
                                                                        </span>
                                                                    )}
                                                                    <p className="font-bold text-lg inline">¥{expense.amount.toLocaleString()}</p>
                                                                    <p className="text-sm text-gray-600 dark:text-gray-400">{expense.transaction_date}</p>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setEditingId(expense.id)}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => removeExpense(expense.id)}
                                                                        className="text-red-500 hover:text-red-700"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm">
                                                                <span className="inline-block bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs mr-2">
                                                                    {expense.department === 'PHOTO' && '写真事業'}
                                                                    {expense.department === 'VIDEO' && '動画事業'}
                                                                    {expense.department === 'WEB' && 'WEB制作'}
                                                                    {expense.department === 'COMMON' && '共通経費'}
                                                                </span>
                                                                {expense.account_item}
                                                            </p>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{expense.description || '-'}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={resetBatchForm}
                                        className="flex-1"
                                    >
                                        キャンセル
                                    </Button>
                                    <Button
                                        onClick={startRegistering}
                                        disabled={analyzedCount === 0}
                                        className="flex-1"
                                    >
                                        <CheckCircle2 className="mr-2 h-5 w-5" />
                                        {analyzedCount}件を登録する
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 'registering' && (
                            <motion.div
                                key="registering"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                <div className="text-center">
                                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">{processingMessage}</h3>
                                    <p className="text-sm text-gray-500">経費を登録しています...</p>
                                </div>

                                <div className="space-y-2">
                                    <Progress value={progressPercent} className="h-3" />
                                    <p className="text-sm text-center text-gray-500">
                                        {currentProcessing} / {totalToProcess} 件完了
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {step === 'complete' && (
                            <motion.div
                                key="complete"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-center space-y-6"
                            >
                                <div>
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">登録完了!</h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        {registeredCount}件の経費を登録しました
                                    </p>
                                </div>

                                <Button
                                    onClick={resetBatchForm}
                                    className="w-full h-12 text-lg"
                                >
                                    <Upload className="mr-2 h-5 w-5" />
                                    続けて登録する
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
