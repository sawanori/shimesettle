import { SalesForm } from "@/components/sales/SalesForm";
import { SalesCsvImportDialog } from "@/components/sales/SalesCsvImportDialog";
import Link from "next/link";

export default function SalesPage() {
    return (
        <div className="min-h-screen p-4 sm:p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-4 sm:gap-8 items-center sm:items-start w-full max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold">売上登録</h1>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <SalesCsvImportDialog />
                        <Link
                            href="/"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            ダッシュボードに戻る
                        </Link>
                    </div>
                </div>
                <SalesForm />
            </main>
        </div>
    );
}
