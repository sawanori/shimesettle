import { SalesForm } from "@/components/sales/SalesForm";
import { SalesCsvImportDialog } from "@/components/sales/SalesCsvImportDialog";
import Link from "next/link";

export default function SalesPage() {
    return (
        <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-8 items-center sm:items-start w-full max-w-4xl mx-auto">
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-3xl font-bold">売上登録</h1>
                    <div className="flex items-center gap-4">
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
