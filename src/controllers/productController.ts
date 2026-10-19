// =====================================================
// CONTROLLERS - Productos e Inventario
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Product, Category } from '../models';

export const CATEGORIES: Category[] = ['PLATOS FUERTES', 'PORCIONES', 'BEBIDAS', 'EXTRAS', 'COMBOS'];
export const PACKAGING_FEE = 0.25;
export type ProductInput = Omit<Product, 'id'>;

function sortProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const catCompare = (a.category || '').localeCompare(b.category || '');
    if (catCompare !== 0) return catCompare;

    return (a.name || '').localeCompare(b.name || '');
  });
}

export function useProductController() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const snap = await getDocs(collection(db, 'products'));

      const formattedProducts: Product[] = snap.docs.map(d => {
        const p: any = d.data();
        return {
          id: d.id,
          name: p.name,
          price: typeof p.price === 'number' ? p.price : parseFloat(p.price || '0'),
          category: p.category as Category,
          requiresPackaging: p.requires_packaging || p.requiresPackaging || false,
          stock: typeof p.stock === 'number' ? p.stock : Number(p.stock) || 0
        };
      });

      setProducts(sortProducts(formattedProducts));
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Error fetching products');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStock = useCallback(async (productId: string, quantityChange: number) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return false;

      const newStock = Math.max(0, product.stock + quantityChange);

      const prodRef = doc(db, 'products', productId);
      await updateDoc(prodRef, { stock: newStock });

      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, stock: newStock } : p
      ));

      return true;
    } catch (err) {
      console.error('Error updating stock:', err);
      return false;
    }
  }, [products]);

  const createProduct = useCallback(async (input: ProductInput): Promise<boolean> => {
    try {
      const productData = {
        name: input.name.trim(),
        price: input.price,
        category: input.category,
        requires_packaging: input.requiresPackaging,
        stock: input.stock
      };

      const productRef = await addDoc(collection(db, 'products'), productData);
      const newProduct: Product = {
        id: productRef.id,
        ...input,
        name: input.name.trim()
      };

      setProducts(prev => sortProducts([...prev, newProduct]));
      return true;
    } catch (err) {
      console.error('Error creating product:', err);
      return false;
    }
  }, []);

  const updateProduct = useCallback(async (productId: string, input: ProductInput): Promise<boolean> => {
    try {
      const productData = {
        name: input.name.trim(),
        price: input.price,
        category: input.category,
        requires_packaging: input.requiresPackaging,
        stock: input.stock
      };

      await updateDoc(doc(db, 'products', productId), productData);
      setProducts(prev => sortProducts(prev.map(product =>
        product.id === productId
          ? { id: productId, ...input, name: input.name.trim() }
          : product
      )));

      return true;
    } catch (err) {
      console.error('Error updating product:', err);
      return false;
    }
  }, []);

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      setProducts(prev => prev.filter(product => product.id !== productId));
      return true;
    } catch (err) {
      console.error('Error deleting product:', err);
      return false;
    }
  }, []);

  const getProductsByCategory = useCallback((category: Category): Product[] => {
    return products.filter(p => p.category === category);
  }, [products]);

  const getProductById = useCallback((id: string): Product | undefined => {
    return products.find(p => p.id === id);
  }, [products]);

  const isInStock = useCallback((productId: string): boolean => {
    const product = products.find(p => p.id === productId);
    return product ? product.stock > 0 : false;
  }, [products]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    fetchProducts,
    updateStock,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByCategory,
    getProductById,
    isInStock
  };
}
