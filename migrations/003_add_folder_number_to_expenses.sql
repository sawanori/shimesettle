-- Add folder_number column to expenses table
-- This column stores the receipt folder number for organizing receipts

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS folder_number TEXT;

-- Create an index for faster searching by folder_number
CREATE INDEX IF NOT EXISTS idx_expenses_folder_number ON expenses(folder_number);

COMMENT ON COLUMN expenses.folder_number IS 'Receipt folder number for organizing and searching receipts';
