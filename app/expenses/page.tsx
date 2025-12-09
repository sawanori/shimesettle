import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import Link from "next/link";

export default function ExpensesPage() {
    return (
        <div className="min-h-screen p-4 sm:p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-4 sm:gap-8 items-center sm:items-start w-full max-w-4xl mx-auto">
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-2xl sm:text-3xl font-bold">経費登録</h1>
                    <Link
                        href="/"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        ダッシュボードに戻る
                    </Link>
                </div>
                <ExpenseForm />
            </main>
        </div>
    );
}
