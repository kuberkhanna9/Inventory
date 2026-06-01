-- supabase_setup.sql
-- Run this in your Supabase SQL Editor to set up the schema, triggers, and Row Level Security (RLS) policies.

-- Create custom enum types if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM (
            'STOCK_IN',
            'SALE',
            'RETURN',
            'DAMAGE',
            'ADJUSTMENT_IN',
            'ADJUSTMENT_OUT'
        );
    END IF;
END$$;

-- Create tables matching our schema

-- 1. profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'STAFF'::user_role NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description VARCHAR(1000),
    brand VARCHAR(100),
    season VARCHAR(50),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(100) NOT NULL,
    size VARCHAR(50) NOT NULL,
    material VARCHAR(100),
    rack_location VARCHAR(50),
    cost_price NUMERIC(12, 2) NOT NULL,
    wholesale_price NUMERIC(12, 2) NOT NULL,
    mrp NUMERIC(12, 2) NOT NULL,
    minimum_stock_level INTEGER DEFAULT 0 NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. stock_transactions table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    transaction_type transaction_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_number VARCHAR(100),
    remarks VARCHAR(500),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. price_history table
CREATE TABLE IF NOT EXISTS public.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    old_cost_price NUMERIC(12, 2) NOT NULL,
    new_cost_price NUMERIC(12, 2) NOT NULL,
    old_wholesale_price NUMERIC(12, 2) NOT NULL,
    new_wholesale_price NUMERIC(12, 2) NOT NULL,
    old_mrp NUMERIC(12, 2) NOT NULL,
    new_mrp NUMERIC(12, 2) NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    module VARCHAR(100) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ----------------------------------------------------
-- DATABASE LEVEL IMMUTABILITY FOR TRANSACTIONS
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_transaction_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Transactions are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_prevent_transaction_update_delete
    BEFORE UPDATE OR DELETE ON public.stock_transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_transaction_modification();

-- ----------------------------------------------------
-- AUTOMATIC AUTH PROFILE CREATION SYNC
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role user_role := 'STAFF'::user_role;
BEGIN
    -- If the registering email is the first one or specific metadata specifies admin, set role to ADMIN
    -- Otherwise, default to STAFF
    IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
        default_role := 'ADMIN'::user_role;
    END IF;

    INSERT INTO public.profiles (id, full_name, role, active)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        default_role,
        TRUE
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- HELPER RLS FUNCTIONS
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'ADMIN'::user_role AND active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------

-- 1. Profiles Policies
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Profiles can only be modified by admins"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 2. Products Policies
CREATE POLICY "Products are viewable by active users"
    ON public.products FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Products can be managed by admins only"
    ON public.products FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 3. Product Variants Policies
CREATE POLICY "Product variants are viewable by active users"
    ON public.product_variants FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Product variants can be managed by admins only"
    ON public.product_variants FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 4. Stock Transactions Policies
CREATE POLICY "Stock transactions are viewable by active users"
    ON public.stock_transactions FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Stock transactions can be inserted by admins only"
    ON public.stock_transactions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- 5. Price History Policies
CREATE POLICY "Price history is viewable by active users"
    ON public.price_history FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Price history can be created by admins only"
    ON public.price_history FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- 6. Audit Logs Policies
CREATE POLICY "Audit logs are viewable by active users"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Audit logs can be created by authenticated users"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);
