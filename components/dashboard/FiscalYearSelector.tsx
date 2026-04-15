"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import { getFiscalYearLabel } from "@/lib/fiscalYear";

interface FiscalYearSelectorProps {
    years: number[];
    currentYear: number;
}

export function FiscalYearSelector({ years, currentYear }: FiscalYearSelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleValueChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("year", value);
        router.push(`/?${params.toString()}`);
    };

    return (
        <Select value={currentYear.toString()} onValueChange={handleValueChange}>
            <SelectTrigger className="w-[300px] bg-white">
                <SelectValue placeholder="年度を選択" />
            </SelectTrigger>
            <SelectContent>
                {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                        {getFiscalYearLabel(year)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
