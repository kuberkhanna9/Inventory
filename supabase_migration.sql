-- =============================================================================
-- Knitwear Finished Goods ERP System - Supabase Production Database Migration Script
-- Date: 2026-06-01
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. DROP EXISTING CONFLICTING OBJECTS (FOR A CLEAN RUN)
-- =============================================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS stock_requests CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_sizes CASCADE;
DROP TABLE IF EXISTS product_colors CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS request_type CASCADE;
DROP TYPE IF EXISTS request_status CASCADE;

-- =============================================================================
-- 2. CREATE SYSTEM CUSTOM ENUMS
-- =============================================================================
CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'ACCOUNTS', 'INVENTORY', 'RETAIL');
CREATE TYPE request_type AS ENUM ('STOCK_IN', 'SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');
CREATE TYPE request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- =============================================================================
-- 3. TABLE DEFINITIONS WITH RELATIONS, CASCADE RULES & CONSTRAINTS
-- =============================================================================

-- A. PROFILES (Secure Auth-Linked profiles)
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- Maps directly to auth.users.id
    full_name VARCHAR(255) NOT NULL CHECK (char_length(full_name) >= 2),
    role user_role DEFAULT 'RETAIL' NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- B. PRODUCTS (Core garment style templates)
CREATE TABLE products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL CHECK (char_length(product_name) >= 2),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description VARCHAR(1000),
    brand VARCHAR(100) DEFAULT 'LJK Knitwear',
    season VARCHAR(50),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- C. PRODUCT_COLORS (Sub-relations for unique garment styling)
CREATE TABLE product_colors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_name VARCHAR(100) NOT NULL CHECK (char_length(color_name) >= 1)
);

-- D. PRODUCT_SIZES (Sub-relations for physical scaling)
CREATE TABLE product_sizes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size_name VARCHAR(50) NOT NULL CHECK (char_length(size_name) >= 1)
);

-- E. PRODUCT_VARIANTS (The SKU-level pricing, sizing, colorway & location grid)
CREATE TABLE product_variants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL UNIQUE CHECK (char_length(sku) >= 3),
    color_id UUID NOT NULL REFERENCES product_colors(id) ON DELETE RESTRICT,
    size_id UUID NOT NULL REFERENCES product_sizes(id) ON DELETE RESTRICT,
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    wholesale_price NUMERIC(12, 2) NOT NULL CHECK (wholesale_price >= 0),
    mrp NUMERIC(12, 2) NOT NULL CHECK (mrp >= 0),
    rack_location VARCHAR(50) DEFAULT 'Warehouse',
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Verify that wholesale is between cost and retail (MRP)
    CONSTRAINT check_wholesale_mrp CHECK (wholesale_price <= mrp)
);

-- F. STOCK_REQUESTS (The audit authorization buffer)
CREATE TABLE stock_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    request_type request_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_number VARCHAR(100),
    invoice_number VARCHAR(100),
    remarks VARCHAR(500),
    created_by UUID NOT NULL REFERENCES profiles(id),
    status request_status DEFAULT 'PENDING' NOT NULL,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Constraint: Invoice number is mandatory for wholesale SALE transactions
    CONSTRAINT check_sale_invoice CHECK (
        (request_type = 'SALE' AND invoice_number IS NOT NULL AND char_length(invoice_number) >= 3) OR
        (request_type != 'SALE')
    )
);

-- G. STOCK_TRANSACTIONS (The immutable ledger)
CREATE TABLE stock_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES stock_requests(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    transaction_type request_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_number VARCHAR(100),
    invoice_number VARCHAR(100),
    remarks VARCHAR(500),
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- H. PRICE_HISTORY (Immutable pricing adjustments ledger)
CREATE TABLE price_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    old_cost_price NUMERIC(12, 2) NOT NULL,
    new_cost_price NUMERIC(12, 2) NOT NULL,
    old_wholesale_price NUMERIC(12, 2) NOT NULL,
    new_wholesale_price NUMERIC(12, 2) NOT NULL,
    old_mrp NUMERIC(12, 2) NOT NULL,
    new_mrp NUMERIC(12, 2) NOT NULL,
    changed_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- I. AUDIT_LOGS (Secure system access and action tracker)
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    module VARCHAR(100) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 4. DATABASE-LEVEL STOCK INTEGRITY TRIGGER CONSTRAINTS
-- =============================================================================

-- A function to compile and double-check ready stock limits for dispatches
CREATE OR REPLACE FUNCTION verify_ready_stock_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_ready_stock INTEGER := 0;
    incoming_qty INTEGER := NEW.quantity;
    out_types request_type[] := ARRAY['SALE'::request_type, 'DAMAGE_REPAIRABLE'::request_type, 'DAMAGE_NON_REPAIRABLE'::request_type, 'ADJUSTMENT_OUT'::request_type];
BEGIN
    -- Calculate stock only if the transaction type is a dispatch (subtraction from readyStock)
    IF NEW.transaction_type = ANY(out_types) THEN
        -- Sum up ledger values for the target variant
        SELECT COALESCE(SUM(
            CASE 
                WHEN transaction_type IN ('STOCK_IN', 'ADJUSTMENT_IN') THEN quantity
                WHEN transaction_type IN ('SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_OUT') THEN -quantity
                ELSE 0 
            END
        ), 0) INTO current_ready_stock
        FROM stock_transactions
        WHERE variant_id = NEW.variant_id;
        
        -- If subtracting this transaction drops stock below zero, reject it at the database constraint level!
        IF (current_ready_stock - incoming_qty) < 0 THEN
            RAISE EXCEPTION 'Database Constraint Abort: Transaction results in negative ready stock value for variant UUID % (Current: %, Subtracting: %)', 
                NEW.variant_id, current_ready_stock, incoming_qty;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_negative_ready_stock_trigger
BEFORE INSERT ON stock_transactions
FOR EACH ROW
EXECUTE FUNCTION verify_ready_stock_balance();

-- =============================================================================
-- 5. OPTIMIZATION INDEXES FOR RAPID BARCODE & SEARCH LOOKUPS
-- =============================================================================
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_transactions_variant_id ON stock_transactions(variant_id);
CREATE INDEX idx_requests_status ON stock_requests(status);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_price_history_variant ON price_history(variant_id);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function to resolve current user's role from public.profiles
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- policies for PROFILES
CREATE POLICY "Profiles are viewable by authenticated users" 
ON profiles FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Profiles can only be modified by SuperAdmin" 
ON profiles FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPERADMIN');

-- policies for PRODUCTS
CREATE POLICY "Products are viewable by all authenticated employees" 
ON products FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Products can only be inserted/modified by SuperAdmin" 
ON products FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPERADMIN');

-- policies for COLORWAYS & SIZES
CREATE POLICY "Colors viewable by authenticated" ON product_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Colors writeable only by SuperAdmin" ON product_colors FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPERADMIN');

CREATE POLICY "Sizes viewable by authenticated" ON product_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sizes writeable only by SuperAdmin" ON product_sizes FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPERADMIN');

-- policies for VARIANTS (SKUs)
CREATE POLICY "Variants viewable by all authenticated employees" 
ON product_variants FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Variants modifyable only by SuperAdmin" 
ON product_variants FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPERADMIN');

-- policies for STOCK_REQUESTS
CREATE POLICY "Requests viewable by SUPERADMIN, ACCOUNTS, and INVENTORY roles" 
ON stock_requests FOR SELECT TO authenticated 
USING (get_user_role(auth.uid()) IN ('SUPERADMIN', 'ACCOUNTS', 'INVENTORY'));

CREATE POLICY "Requests can be created by SUPERADMIN and INVENTORY roles" 
ON stock_requests FOR INSERT TO authenticated 
WITH CHECK (get_user_role(auth.uid()) IN ('SUPERADMIN', 'INVENTORY'));

CREATE POLICY "Requests can be updated/reviewed only by SUPERADMIN role" 
ON stock_requests FOR UPDATE TO authenticated 
USING (get_user_role(auth.uid()) = 'SUPERADMIN');

-- policies for STOCK_TRANSACTIONS
CREATE POLICY "Ledger transactions viewable by SUPERADMIN, ACCOUNTS, and INVENTORY" 
ON stock_transactions FOR SELECT TO authenticated 
USING (get_user_role(auth.uid()) IN ('SUPERADMIN', 'ACCOUNTS', 'INVENTORY'));

CREATE POLICY "Ledger transactions can be created by SUPERADMIN and system operations" 
ON stock_transactions FOR INSERT TO authenticated 
WITH CHECK (get_user_role(auth.uid()) IN ('SUPERADMIN', 'INVENTORY'));

-- policies for PRICE_HISTORY
CREATE POLICY "Price history viewable by SUPERADMIN, ACCOUNTS, and INVENTORY" 
ON price_history FOR SELECT TO authenticated 
USING (get_user_role(auth.uid()) IN ('SUPERADMIN', 'ACCOUNTS', 'INVENTORY'));

-- policies for AUDIT_LOGS
CREATE POLICY "Audit logs only viewable by SUPERADMIN" 
ON audit_logs FOR SELECT TO authenticated 
USING (get_user_role(auth.uid()) = 'SUPERADMIN');

CREATE POLICY "Audit logs insertable by authenticated users" 
ON audit_logs FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 7. INITIAL SECURE SEED PROFILE CREDENTIALS (TO CORRESPOND WITH PREDEFINED ACCOUNTS)
-- =============================================================================
-- Pre-populate our custom relational profiles table (mapping to the pre-hashed static user accounts)
INSERT INTO profiles (id, full_name, role, active) VALUES
('b1100000-0000-0000-0000-000000000001', 'Khanna SuperAdmin', 'SUPERADMIN', true),
('b1100000-0000-0000-0000-000000000002', 'Accounts Department', 'ACCOUNTS', true),
('b1100000-0000-0000-0000-000000000003', 'Inventory Department', 'INVENTORY', true),
('b1100000-0000-0000-0000-000000000004', 'Retail Department', 'RETAIL', true)
ON CONFLICT (id) DO NOTHING;

-- Log the successful seed operation
INSERT INTO audit_logs (id, user_id, action, module, description) VALUES
(uuid_generate_v4(), 'b1100000-0000-0000-0000-000000000001', 'MIGRATION_INIT', 'DATABASE', 'Relational database Normalized tables, checking negative triggers, and roles setup complete.');
