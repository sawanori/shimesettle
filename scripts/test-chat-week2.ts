import { calculateDateRange, formatCurrencyShort, formatPercentage, getTrendIcon, getPreviousMonthRange, getDateRangeLabel } from '@/lib/chat/utils';
import { getResponseGenerationPrompt } from '@/lib/chat/prompts';
import { type QueryResult } from '@/lib/chat/types';

console.log('--- Verifying Chat Feature Week 2 Implementation ---\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`✅ ${message}`);
        passed++;
    } else {
        console.error(`❌ ${message}`);
        failed++;
    }
}

// 1. Date Range Utilities (CHAT-026)
console.log('\n[Date Range Utilities]');
const prevMonth = getPreviousMonthRange(new Date('2024-11-15'));
assert(prevMonth.start === '2024-10-01' && prevMonth.end === '2024-10-31', `Previous month of Nov 2024 should be Oct 2024. Got ${prevMonth.start}~${prevMonth.end}`);

const labelSameMonth = getDateRangeLabel('2024-11-01', '2024-11-30');
assert(labelSameMonth === '2024年11月', `Same month label: ${labelSameMonth}`);

const labelFiscalYear = getDateRangeLabel('2024-11-01', '2025-10-31');
assert(labelFiscalYear === '2025年度', `Fiscal year label: ${labelFiscalYear}`);

// 2. Currency Formatting (CHAT-039)
console.log('\n[Currency Formatting]');
assert(formatCurrencyShort(1234567) === '約123万円', 'Short format 1.2M -> 123万円');
assert(formatCurrencyShort(150000000) === '約2億円', 'Short format 150M -> 2億円');
assert(formatPercentage(0.123) === '+12.3%', 'Percentage format 0.123 -> +12.3%');
assert(getTrendIcon(100, 80) === '↑', 'Trend Up Icon');
assert(getTrendIcon(80, 100) === '↓', 'Trend Down Icon');

// 3. Response Generation Prompts (CHAT-037)
console.log('\n[Response Prompts]');
const mockResult: QueryResult = {
    type: 'summary',
    data: [{ amount: 1000 }],
    metadata: { query_type: 'expense_summary' }
};
const prompt = getResponseGenerationPrompt('経費教えて', mockResult);
assert(prompt.includes('あなたは親切で知識豊富な会計アシスタントです'), 'Prompt contains persona definition');
assert(prompt.includes('経費教えて'), 'Prompt contains user message');

console.log(`\n--- Summary: ${passed} Passed, ${failed} Failed ---`);
if (failed > 0) process.exit(1);
