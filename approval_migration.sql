-- =============================================================================
-- Approval Workflow Optimization (Refined) — Supabase Migration Script
-- Date: 2026-07-20
-- Expected minimal database changes.
-- =============================================================================

-- 1. Create approval_policies table
CREATE TABLE IF NOT EXISTS approval_policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transaction_key VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    approval_mode VARCHAR(20) DEFAULT 'MANUAL' NOT NULL CHECK (approval_mode IN ('AUTO', 'MANUAL', 'THRESHOLD')),
    threshold_quantity INTEGER DEFAULT 0 NOT NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Alter stock_requests table to add approved_by, approved_at, and approval_method columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_requests' AND column_name = 'approval_method'
    ) THEN
        ALTER TABLE stock_requests ADD COLUMN approval_method VARCHAR(20) CHECK (approval_method IN ('AUTO', 'MANUAL', 'BULK'));
    END IF;
END$$;

-- Backfill existing approved/rejected requests
UPDATE stock_requests
SET approved_by = reviewed_by,
    approved_at = reviewed_at,
    approval_method = 'MANUAL'
WHERE status IN ('APPROVED', 'REJECTED') AND approved_by IS NULL;

-- 3. Row Level Security for approval_policies
ALTER TABLE approval_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approval policies viewable by SUPERADMIN"
ON approval_policies FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) = 'SUPERADMIN');

CREATE POLICY "Approval policies manageable by SUPERADMIN"
ON approval_policies FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'SUPERADMIN');

-- 4. Seed default policies for current Inventory transaction types
-- Inventory request types in the database enum: 'STOCK_IN', 'SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'
INSERT INTO approval_policies (transaction_key, display_name, approval_mode, threshold_quantity) VALUES
('STOCK_IN', 'Stock In (Production)', 'MANUAL', 0),
('SALE', 'Stock Out (Sale)', 'MANUAL', 0),
('DAMAGE_REPAIRABLE', 'Repairable Damage', 'MANUAL', 0),
('DAMAGE_NON_REPAIRABLE', 'Non-Repairable Damage (Scrap)', 'MANUAL', 0),
('ADJUSTMENT_IN', 'Stock Adjustment (In)', 'MANUAL', 0),
('ADJUSTMENT_OUT', 'Stock Adjustment (Out)', 'MANUAL', 0)
ON CONFLICT (transaction_key) DO NOTHING;

INSERT INTO audit_logs (id, user_id, action, module, description) VALUES
(uuid_generate_v4(), 'b1100000-0000-0000-0000-000000000001', 'MIGRATION_REFINED_APPROVAL', 'INVENTORY',
 'Refined approval policies table created and stock_requests altered with approved_by and approved_at columns.');

-- 5. Refinements for Bulk Rate Approval feature
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'PENDING_RATE_APPROVAL';

ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS original_wsp NUMERIC(12, 2);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS original_mrp NUMERIC(12, 2);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_wsp NUMERIC(12, 2);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_mrp NUMERIC(12, 2);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS price_change_status VARCHAR(30);

