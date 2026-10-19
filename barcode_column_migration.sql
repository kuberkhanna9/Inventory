-- =============================================================================
-- Product Variant Barcode Column Migration
-- File: barcode_column_migration.sql
-- Date: 2026-10-19
-- Purpose: Add primary barcode column to product_variants table and create search index
-- =============================================================================

-- 1. Safely add barcode column to product_variants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'product_variants' AND column_name = 'barcode'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN barcode VARCHAR(100);
    END IF;
END$$;

-- 2. Create index on barcode column for ultra-fast barcode lookup and scanner search
CREATE INDEX IF NOT EXISTS product_variants_barcode_idx ON product_variants(barcode);
