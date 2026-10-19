-- Add anonymous access policies for the POS system
CREATE POLICY "orders_select_anon" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "orders_insert_anon" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "orders_update_anon" ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "orders_delete_anon" ON orders FOR DELETE TO anon USING (true);

CREATE POLICY "order_items_select_anon" ON order_items FOR SELECT TO anon USING (true);
CREATE POLICY "order_items_insert_anon" ON order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "order_items_update_anon" ON order_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "order_items_delete_anon" ON order_items FOR DELETE TO anon USING (true);