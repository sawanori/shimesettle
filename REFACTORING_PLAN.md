# Refactoring Roadmap & Tickets

This document outlines a detailed action plan for refactoring the ShimeSettle codebase.
**Role Assignment:**
- **Claude**: Backend, API Routes, Security, Database interactions (Supabase).
- **Antigravity**: Frontend Components, UI/UX, Client-side logic.

## Phase 1: Backend & API Utilities (Assigned to: Claude)

### TICKET-REF-001: Extract API Security Utilities
**Assigned to**: Claude
**Goal**: Centralize security logic (SSRF protection and Rate Limiting) to avoid duplication.
**Files**:
- Create: `lib/api-security.ts`
- Modify: `app/api/analyze-invoice/route.ts` (to verify usage later)
**Instructions**:
1. Create `lib/api-security.ts`.
2. Extract the `isAllowedUrl(url: string): boolean` function.
   - Include the `ALLOWED_DOMAINS` constant.
   - Ensure it checks for private IPs, localhost, and protocol.
3. Extract the `checkRateLimit(userId: string): boolean` function.
   - Move the `rateLimitMap` and constants (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`) here.
**Acceptance Criteria**:
- Functions are exported and typed correctly.
- No logic changes, just extraction.

### TICKET-REF-002: Extract PDF Parsing Utility
**Assigned to**: Claude
**Goal**: Encapsulate PDF text extraction logic using `pdf2json` to ensure consistency and error handling.
**Files**:
- Create: `lib/pdf-utils.ts`
**Instructions**:
1. Create `lib/pdf-utils.ts`.
2. Implement and export `export async function extractTextFromPdf(buffer: Buffer): Promise<string>`.
3. Use `pdf2json` (import as `const PDFParser = require("pdf2json");` or default import if types allow).
4. Wrap the parser events (`pdfParser_dataReady`, `pdfParser_dataError`) in a Promise.
5. Ensure the parser is instantiated with `new PDFParser(null, true)` (raw text mode).
**Acceptance Criteria**:
- Function accepts a Buffer and returns a Promise<string>.
- Handles parsing errors by rejecting the promise.

### TICKET-REF-003: Centralize Zod Schemas
**Assigned to**: Claude
**Goal**: Share validation schemas between API and Frontend to ensure data consistency.
**Files**:
- Create: `lib/schemas.ts`
**Instructions**:
1. Create `lib/schemas.ts`.
2. Move `InvoiceSchema` from `app/api/analyze-invoice/route.ts`.
3. Move `ReceiptSchema` from `app/api/analyze-receipt/route.ts`.
4. Export TypeScript types for both:
   ```typescript
   export type Invoice = z.infer<typeof InvoiceSchema>;
   export type Receipt = z.infer<typeof ReceiptSchema>;
   ```
**Acceptance Criteria**:
- Schemas are exported as `z.ZodObject`.
- Types are exported.

### TICKET-REF-004: Refactor Invoice Analysis API
**Assigned to**: Claude
**Goal**: Clean up `analyze-invoice` route by using the new utility libraries.
**Files**:
- Modify: `app/api/analyze-invoice/route.ts`
**Instructions**:
1. Import `isAllowedUrl`, `checkRateLimit` from `lib/api-security`.
2. Import `extractTextFromPdf` from `lib/pdf-utils`.
3. Import `InvoiceSchema` from `lib/schemas`.
4. Replace the inline implementations with these imported functions.
5. Ensure the logic flow remains: Auth -> Rate Limit -> URL Check -> PDF/Image processing -> OpenAI Call -> Validation.
**Acceptance Criteria**:
- The file size should decrease significantly.
- Functionality (PDF and Image analysis) remains unchanged.

### TICKET-REF-005: Refactor Receipt Analysis API
**Assigned to**: Claude
**Goal**: Clean up `analyze-receipt` route by using the new utility libraries.
**Files**:
- Modify: `app/api/analyze-receipt/route.ts`
**Instructions**:
1. Apply the same refactoring as TICKET-REF-004 but for the receipt analysis route.
2. Use `ReceiptSchema` from `lib/schemas`.
**Acceptance Criteria**:
- Code duplication between invoice and receipt APIs is minimized.

## Phase 2: Frontend Components (Assigned to: Antigravity)

### TICKET-REF-006: Create Generic FileUploader Component
**Assigned to**: Antigravity
**Goal**: Create a reusable drag-and-drop file uploader to replace duplicated logic.
**Files**:
- Create: `components/ui/file-uploader.tsx`
**Instructions**:
1. Create a component `FileUploader`.
2. Props:
   - `onFilesSelected: (files: File[]) => void`
   - `maxFiles?: number` (default 1)
   - `accept?: string[]` (default `['image/*', '.pdf']`)
   - `disabled?: boolean`
   - `className?: string`
3. Implement drag-and-drop logic (dragover, drop handlers).
4. Implement file validation (type check, max files check).
5. Provide visual feedback for drag state.
**Acceptance Criteria**:
- Component is generic and not tied to "Invoices" or "Receipts".
- Can handle both single and multiple file modes based on `maxFiles`.

### TICKET-REF-007: Refactor InvoiceUploader
**Assigned to**: Antigravity
**Goal**: Simplify `InvoiceUploader` by using `FileUploader`.
**Files**:
- Modify: `components/sales/InvoiceUploader.tsx`
**Instructions**:
1. Replace the internal drag-and-drop logic with `<FileUploader />`.
2. Keep the Supabase upload logic (`uploadFile` function) as this is specific to the business logic (uploading to 'receipts' bucket).
3. The flow should be: `FileUploader` -> `onFilesSelected` -> `uploadFile` -> `onUploadComplete`.
**Acceptance Criteria**:
- UI looks consistent.
- Upload functionality works as before.

### TICKET-REF-008: Refactor ReceiptUploader
**Assigned to**: Antigravity
**Goal**: Simplify `ReceiptUploader` by using `FileUploader`.
**Files**:
- Modify: `components/expenses/ReceiptUploader.tsx`
**Instructions**:
1. Replace internal logic with `<FileUploader />`.
2. Pass `maxFiles={4}`.
3. Ensure the preview grid logic works with the files returned by `FileUploader`.
**Acceptance Criteria**:
- Multiple file selection works.
- Previews are displayed correctly.
