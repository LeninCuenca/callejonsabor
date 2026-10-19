-- Update products table with stock
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  requires_packaging BOOLEAN NOT NULL DEFAULT false,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial menu data
INSERT INTO products (id, name, price, category, requires_packaging, stock) VALUES
-- PLATOS FUERTES
('pf-1', 'Filete de Pollo', 2.50, 'PLATOS FUERTES', true, 20),
('pf-2', 'Chuleta de Cerdo', 3.50, 'PLATOS FUERTES', true, 15),
('pf-3', 'Costilla de Cerdo', 4.00, 'PLATOS FUERTES', true, 10),
('pf-4', 'Presa de Pollo', 2.50, 'PLATOS FUERTES', true, 20),
('pf-5', 'Pincho de Camaron', 3.50, 'PLATOS FUERTES', true, 15),
('pf-6', 'Papi Pollo', 2.50, 'PLATOS FUERTES', true, 30),
('pf-7', 'Salchipapa', 1.50, 'PLATOS FUERTES', true, 40),
('pf-8', 'Choclo Asado', 1.50, 'PLATOS FUERTES', false, 15),
-- PORCIONES
('por-1', 'Papa', 1.00, 'PORCIONES', false, 50),
('por-2', 'Arroz', 1.00, 'PORCIONES', false, 50),
('por-3', 'Menestra', 1.00, 'PORCIONES', false, 50),
-- BEBIDAS
('beb-1', 'Jarra de Horchata', 3.00, 'BEBIDAS', false, 20),
('beb-2', '1/2 Jarra de Horchata', 1.50, 'BEBIDAS', false, 20),
('beb-3', 'Vaso de Horchata', 0.50, 'BEBIDAS', false, 50),
('beb-4', 'Cafe', 0.75, 'BEBIDAS', false, 30),
('beb-5', 'Cola Personal', 0.75, 'BEBIDAS', false, 40),
('beb-6', 'Cola de Litro', 1.25, 'BEBIDAS', false, 20),
-- EXTRAS
('ext-1', 'Bandeja Extra para Llevar', 0.25, 'EXTRAS', false, 100);

-- Drop old tables and recreate with new structure
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;

-- Create new orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeaway')),
  table_number INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  packaging_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Create order items table with payment tracking
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  packaging_surcharge DECIMAL(10,2) NOT NULL DEFAULT 0,
  item_total DECIMAL(10,2) NOT NULL,
  is_takeaway BOOLEAN NOT NULL DEFAULT false,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create payments table for tracking multiple payments per order
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  receipt_photo_url TEXT,
  item_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for anon access
CREATE POLICY "products_select" ON products FOR SELECT TO anon USING (true);
CREATE POLICY "products_update" ON products FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "orders_select" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "orders_delete" ON orders FOR DELETE TO anon USING (true);

CREATE POLICY "order_items_select" ON order_items FOR SELECT TO anon USING (true);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "order_items_update" ON order_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "order_items_delete" ON order_items FOR DELETE TO anon USING (true);

CREATE POLICY "payments_select" ON payments FOR SELECT TO anon USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "payments_delete" ON payments FOR DELETE TO anon USING (true);

-- Create indexes
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);