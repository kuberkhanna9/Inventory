-- =============================================================================
-- Bulk Sale Pricing & Rate Approval Migration Script
-- File: bulk_sale_pricing_migration.sql
-- Date: 2026-07-21
-- Purpose: Add pricing approval and audit fields to stock_requests table in Supabase.
-- =============================================================================

-- 1. Ensure PENDING_RATE_APPROVAL is added to request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'PENDING_RATE_APPROVAL';

-- 2. Add pricing & rate approval columns to stock_requests table safely and idempotently
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'original_wsp'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN original_wsp NUMERIC(12, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'original_mrp'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN original_mrp NUMERIC(12, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'requested_wsp'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN requested_wsp NUMERIC(12, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'requested_mrp'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN requested_mrp NUMERIC(12, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'price_change_status'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN price_change_status VARCHAR(30);
    END IF;
END$$;
