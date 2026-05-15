-- schema.sql
-- Run this in your Supabase SQL Editor

-- Clean up existing tables (Optional: remove these if you want to keep existing data)
DROP TABLE IF EXISTS public.cart_items;
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.users;

-- Create Users Table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create Products Table
CREATE TABLE public.products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    scent_family TEXT,
    burn_time TEXT,
    stock_quantity INTEGER DEFAULT 0,
    image_url TEXT,
    scent_profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create Sessions Table
CREATE TABLE public.sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create Cart Items Table
CREATE TABLE public.cart_items (
    user_id TEXT NOT NULL,
    product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, product_id)
);

-- Disable RLS for all tables to allow simple access
-- (In a production app, you would instead set up specific RLS policies)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items DISABLE ROW LEVEL SECURITY;

-- Seed Data for Products
INSERT INTO public.products (name, description, price, scent_family, burn_time, stock_quantity, image_url, scent_profile) VALUES
('Midnight Lavender', 'A calming blend of French lavender and deep woods, perfect for unwinding after a long day.', 28.00, 'Floral', '45-50 hours', 15, 'https://images.unsplash.com/photo-1605814046907-7bc944d18721?auto=format&fit=crop&q=80&w=800', '{"top": "Bergamot", "middle": "French Lavender", "base": "Cedarwood"}'),
('Sandalwood & Fig', 'Warm, earthy sandalwood paired with the subtle sweetness of ripe fig. An elegant and grounding aroma.', 32.00, 'Woody', '50-60 hours', 8, 'https://images.unsplash.com/photo-1602874801007-bd458cb6b9ea?auto=format&fit=crop&q=80&w=800', '{"top": "Fig Leaf", "middle": "Violet", "base": "Sandalwood"}'),
('Sicilian Lemon', 'Bright and refreshing citrus notes that energize any space. Like a sunny day in a jar.', 24.00, 'Citrus', '40-45 hours', 20, 'https://images.unsplash.com/photo-1608181708892-3c224b52e391?auto=format&fit=crop&q=80&w=800', '{"top": "Lemon Zest", "middle": "Basil", "base": "White Musk"}'),
('Forest Rain', 'The crisp scent of damp earth and pine needles after a heavy rainfall.', 26.00, 'Earthy', '45-55 hours', 12, 'https://images.unsplash.com/photo-1591122822187-5784c6c06a88?auto=format&fit=crop&q=80&w=800', '{"top": "Petrichor", "middle": "Pine", "base": "Oakmoss"}');
