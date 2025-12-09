# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run lint     # Run ESLint

# Playwright E2E tests
npx playwright test                           # Run all tests
npx playwright test --headed                  # Run with browser visible
npx playwright test --grep "Bank Page"        # Run specific test suite
npx playwright test e2e/app.spec.ts           # Run single test file
```

## Project Overview

ShimeSettle (NonTurn決算申告) is an expense, sales, and bank account management app for solo entrepreneurs (ひとり社長). Key features:
- Receipt/Invoice OCR via OpenAI GPT-4o (supports images and PDF)
- Batch expense registration (up to 4 receipts at once with sequential AI processing)
- Expense/sales tracking by department (PHOTO, VIDEO, WEB, COMMON)
- Inline editing and deletion for expenses/sales
- Bank CSV import with multi-bank format support (MUFG, SMBC, GMO Aozora, etc.)
- Fiscal year filtering (November 1 - October 31 cycle)
- Supabase backend with RLS for multi-user support

## Architecture

**Tech Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Supabase + OpenAI + Playwright

### Key Directories

- **app/**: App Router pages and API routes
  - `api/analyze-receipt/`: OpenAI GPT-4o receipt OCR (images + PDF)
  - `api/analyze-invoice/`: OpenAI GPT-4o invoice OCR for sales
  - `api/bank/import-csv/`: Bank CSV import with duplicate detection
  - `api/export-csv/`: Export expenses/sales as Shift-JIS CSV
- **components/**: Feature-organized React components
  - `expenses/`: ExpenseForm (tabbed single/batch), SingleReceiptUploader, ReceiptUploader
  - `sales/`: SalesForm, InvoiceUploader, SalesCsvImportDialog
  - `bank/`: BankAccountForm, CsvImportDialog, BankPageClient
  - `management/`: ManagementTable, EditExpenseDialog, EditSaleDialog, CsvExportButton
  - `dashboard/`: DashboardSummary, RevenueBarChart, SalesPieChart
  - `ui/`: shadcn/ui components
- **lib/**: Core utilities (see Shared Utilities below)
- **types/supabase.ts**: Database types (regenerate with `supabase gen types typescript`)

### Shared Utilities (`lib/`)

| File | Purpose |
|------|---------|
| `api-security.ts` | SSRF protection (`isAllowedUrl`) + Rate limiting (`checkRateLimit`) |
| `pdf-utils.ts` | PDF text extraction (`extractTextFromPdf`) using pdf2json |
| `schemas.ts` | Zod schemas (`InvoiceSchema`, `ReceiptSchema`) + TypeScript types |
| `bankCsvParser.ts` | Multi-bank CSV parser (Shift-JIS/UTF-8 encoding) |
| `fiscalYear.ts` | Fiscal year calculations (Nov 1 - Oct 31 cycle) |
| `salesCsvParser.ts` | Sales CSV import parser |
| `utils.ts` | General utilities (`cn` for className merging) |

### Database Schema (Supabase)

Five main tables with RLS enabled:
- **expenses**: transaction_date, amount, department, account_item, ai_check_status
- **sales**: transaction_date, amount, department, client_name, channel, fee_amount/rate/net_amount
- **bank_accounts**: name, bank_type, branch_name, initial_balance
- **bank_transactions**: transaction_date, description, withdrawal, deposit, balance, import_hash
- **csv_imports**: file_path, file_name, records_count (original CSV storage metadata)

Storage buckets: `receipts`, `invoices`, `bank-csv` (private)

### Data Flow Patterns

**Receipt OCR (Single)**:
1. Upload image → Supabase Storage → `/api/analyze-receipt` → GPT-4o
2. AI extracts date, amount, vendor, account_item → Form auto-populated → User confirms

**Batch Receipt Registration**:
1. Select up to 4 files → Sequential upload to Storage
2. Each file analyzed by GPT-4o one-by-one (with progress bar)
3. Review all results → Edit if needed → Register all at once

**Bank CSV Import**:
1. User adds bank account → CsvImportDialog opens
2. Upload CSV → `parseBankCsv()` detects bank format and encoding
3. Duplicate check via `import_hash` (MD5 of account_id, date, description, amounts)
4. Original CSV saved to Storage for audit trail

### Key Implementation Details

- **Fiscal Year**: November 1 - October 31 (see `lib/fiscalYear.ts`)
- **Bank CSV Encoding**: Most banks use Shift-JIS, Rakuten uses UTF-8
- **Tabs with State Preservation**: Use `forceMount` + `hidden` class on TabsContent to prevent react-hook-form state loss when switching tabs
- **PDF Parsing**: Uses `lib/pdf-utils.ts` with pdf2json
- **API Security**: Use `lib/api-security.ts` for URL validation and rate limiting in API routes

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

## Key Patterns

- Use `@/*` path alias for imports
- Client Components require `'use client'` directive
- Forms use react-hook-form + zod for validation
- Supabase clients: `client.ts` for browser, `server.ts` for Server Components/API routes
- CSV files encoded as Shift-JIS for Excel compatibility in Japan
- Edit dialogs: Use controlled Dialog with `open`/`onOpenChange` props
- API routes: Import security utilities from `@/lib/api-security` and schemas from `@/lib/schemas`
