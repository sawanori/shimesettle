'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@/components/ui/dialog';
import { createClient } from '@/utils/supabase/client';
import { BankAccount, BankType, AccountCategory } from '@/types/supabase';
import { getBankTypeName } from '@/lib/bankCsvParser';
import { Plus, Loader2, Briefcase, User } from 'lucide-react';
import { CsvImportDialog } from './CsvImportDialog';

const formSchema = z.object({
    name: z.string().min(1, '口座名を入力してください'),
    bank_type: z.enum(['MUFG', 'SMBC', 'MIZUHO', 'YUCHO', 'RAKUTEN', 'PAYPAY', 'GMO_AOZORA', 'RAKUTEN_CARD', 'AMEX', 'OTHER_CARD', 'OTHER']),
    bank_name: z.string().min(1, '銀行名を入力してください'),
    branch_name: z.string().optional(),
    account_number: z.string().optional(),
    initial_balance: z.number().default(0),
    category: z.enum(['BUSINESS', 'PERSONAL']).default('BUSINESS'),
});

type FormData = z.infer<typeof formSchema>;

interface BankAccountFormProps {
    onSuccess: () => void;
    defaultCategory?: AccountCategory;
}

const BANK_TYPES: BankType[] = ['MUFG', 'SMBC', 'MIZUHO', 'YUCHO', 'RAKUTEN', 'PAYPAY', 'GMO_AOZORA', 'RAKUTEN_CARD', 'AMEX', 'OTHER_CARD', 'OTHER'];

export function BankAccountForm({ onSuccess, defaultCategory = 'BUSINESS' }: BankAccountFormProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdAccount, setCreatedAccount] = useState<BankAccount | null>(null);
    const [showCsvDialog, setShowCsvDialog] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<AccountCategory>(defaultCategory);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: '',
            bank_type: 'MUFG',
            bank_name: '三菱UFJ銀行',
            branch_name: '',
            account_number: '',
            initial_balance: 0,
            category: defaultCategory,
        },
    });

    // カテゴリが変更されたらフォームも更新
    const handleCategoryChange = (category: AccountCategory) => {
        setSelectedCategory(category);
        form.setValue('category', category);
    };

    // ダイアログが開いた時にdefaultCategoryをセット
    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            setSelectedCategory(defaultCategory);
            form.setValue('category', defaultCategory);
        }
    };

    const handleBankTypeChange = (value: BankType) => {
        form.setValue('bank_type', value);
        form.setValue('bank_name', getBankTypeName(value));
    };

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('認証エラー');

            // bank_type に基づいて account_type を判定
            const creditCardTypes: BankType[] = ['RAKUTEN_CARD', 'AMEX', 'OTHER_CARD'];
            const accountType = creditCardTypes.includes(data.bank_type) ? 'CREDIT_CARD' : 'BANK';

            const { data: insertedAccount, error } = await supabase
                .from('bank_accounts')
                .insert({
                    ...data,
                    account_type: accountType,
                    user_id: user.id,
                })
                .select()
                .single();

            if (error) throw error;

            form.reset();
            setOpen(false);
            setCreatedAccount(insertedAccount as BankAccount);
            setShowCsvDialog(true);
        } catch (error) {
            console.error(error);
            alert('登録に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCsvDialogClose = () => {
        setShowCsvDialog(false);
        setCreatedAccount(null);
        onSuccess();
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        口座・カードを追加
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>銀行口座を追加</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* 口座カテゴリ */}
                        <div className="space-y-2">
                            <Label>口座カテゴリ</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {selectedCategory === 'BUSINESS' ? (
                                    <button
                                        type="button"
                                        onClick={() => handleCategoryChange('BUSINESS')}
                                        className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-medium bg-blue-600 text-white border-blue-600"
                                    >
                                        <Briefcase className="h-5 w-5" />
                                        <span>ビジネス</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleCategoryChange('BUSINESS')}
                                        className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-medium bg-white text-gray-500 border-gray-300 hover:border-blue-400"
                                    >
                                        <Briefcase className="h-5 w-5" />
                                        <span>ビジネス</span>
                                    </button>
                                )}
                                {selectedCategory === 'PERSONAL' ? (
                                    <button
                                        type="button"
                                        onClick={() => handleCategoryChange('PERSONAL')}
                                        className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-medium bg-purple-600 text-white border-purple-600"
                                    >
                                        <User className="h-5 w-5" />
                                        <span>個人</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleCategoryChange('PERSONAL')}
                                        className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-medium bg-white text-gray-500 border-gray-300 hover:border-purple-400"
                                    >
                                        <User className="h-5 w-5" />
                                        <span>個人</span>
                                    </button>
                                )}
                            </div>
                            {selectedCategory === 'PERSONAL' && (
                                <p className="text-xs text-purple-600 dark:text-purple-400">
                                    個人口座はダッシュボードの集計に含まれません
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bank_type">銀行種別</Label>
                            <Select
                                value={form.watch('bank_type')}
                                onValueChange={handleBankTypeChange}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {BANK_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {getBankTypeName(type)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">口座名（管理用）</Label>
                            <Input
                                {...form.register('name')}
                                placeholder="例: 事業用メイン口座"
                            />
                            {form.formState.errors.name && (
                                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="branch_name">支店名</Label>
                                <Input
                                    {...form.register('branch_name')}
                                    placeholder="例: 渋谷支店"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="account_number">口座番号（下4桁）</Label>
                                <Input
                                    {...form.register('account_number')}
                                    placeholder="例: ****1234"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="initial_balance">開始残高（円）</Label>
                            <Input
                                type="number"
                                {...form.register('initial_balance', { valueAsNumber: true })}
                                placeholder="0"
                            />
                            <p className="text-xs text-gray-500">CSV取込開始時点の残高を入力</p>
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            登録
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* CSV Import Dialog - shown after account creation */}
            {createdAccount && (
                <CsvImportDialog
                    account={createdAccount}
                    onSuccess={handleCsvDialogClose}
                    open={showCsvDialog}
                    onOpenChange={(v) => {
                        if (!v) handleCsvDialogClose();
                    }}
                    showTrigger={false}
                />
            )}
        </>
    );
}

export interface BankAccountFormWrapperProps {
    defaultCategory?: AccountCategory;
    onSuccess?: () => void;
}

export function BankAccountFormWrapper({ defaultCategory = 'BUSINESS', onSuccess }: BankAccountFormWrapperProps) {
    const router = useRouter();

    const handleSuccess = () => {
        router.refresh();
        if (onSuccess) onSuccess();
    };

    return <BankAccountForm onSuccess={handleSuccess} defaultCategory={defaultCategory} />;
}
