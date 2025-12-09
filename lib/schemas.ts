/**
 * Shared Zod Schemas
 *
 * Centralized validation schemas for API responses.
 * These schemas ensure data consistency between API and Frontend.
 */

import { z } from 'zod';

// ============================================
// Department Enum (shared across schemas)
// ============================================

/**
 * Business department enum used for categorizing expenses and sales.
 */
export const DepartmentEnum = z.enum(['PHOTO', 'VIDEO', 'WEB', 'COMMON']);

// ============================================
// Invoice Schema
// ============================================

/**
 * Schema for invoice data extracted by OpenAI GPT-4o.
 * Used by /api/analyze-invoice endpoint.
 */
export const InvoiceSchema = z.object({
    /** Date of invoice in YYYY-MM-DD format */
    transaction_date: z.string().describe('YYYY-MM-DD format'),
    /** Total amount including tax */
    amount: z.number(),
    /** Name of the client being billed (Bill To / 請求先) */
    client_name: z.string().describe('Name of the client (Bill To)'),
    /** Business department based on service content */
    department: DepartmentEnum.describe('Business department based on content'),
    /** Brief description of the service provided */
    description: z.string().nullable().describe('Brief description of the service provided'),
});

/**
 * TypeScript type inferred from InvoiceSchema.
 */
export type Invoice = z.infer<typeof InvoiceSchema>;

// ============================================
// Receipt Schema
// ============================================

/**
 * Schema for receipt data extracted by OpenAI GPT-4o.
 * Used by /api/analyze-receipt endpoint.
 */
export const ReceiptSchema = z.object({
    /** Date of transaction in YYYY-MM-DD format */
    transaction_date: z.string().describe('YYYY-MM-DD format'),
    /** Total amount */
    amount: z.number(),
    /** Business department based on items purchased */
    department: DepartmentEnum.describe('Business department based on content'),
    /** Japanese accounting category (勘定科目) */
    account_item: z.string().describe('Accounting category (e.g., 消耗品費, 会議費)'),
    /** Brief description of the expense */
    description: z.string().nullable().describe('Brief description of the expense'),
    /** Name of the store or vendor */
    vendor_name: z.string().describe('Name of the store or vendor'),
});

/**
 * TypeScript type inferred from ReceiptSchema.
 */
export type Receipt = z.infer<typeof ReceiptSchema>;
