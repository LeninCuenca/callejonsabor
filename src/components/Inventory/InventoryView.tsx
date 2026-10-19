// =====================================================
// VIEWS - Components - Gestion de Productos e Inventario
// =====================================================

import { useState } from 'react';
import { Product, Category } from '../../models';
import { CATEGORIES, PACKAGING_FEE, ProductInput } from '../../controllers/productController';
import {
  Package,
  Plus,
  Minus,
  Save,
  Flame,
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Pencil,
  Trash2,
  X
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  onUpdateStock: (productId: string, quantityChange: number) => Promise<boolean>;
  onCreateProduct: (input: ProductInput) => Promise<boolean>;
  onUpdateProduct: (productId: string, input: ProductInput) => Promise<boolean>;
  onDeleteProduct: (productId: string) => Promise<boolean>;
}

type ProductFormState = {
  name: string;
  price: string;
  category: Category;
  stock: string;
  requiresPackaging: boolean;
};

const emptyForm: ProductFormState = {
  name: '',
  price: '',
  category: 'PLATOS FUERTES',
  stock: '0',
  requiresPackaging: false
};

const categoryIcons: Record<Category, React.ReactNode> = {
  'PLATOS FUERTES': <Flame className="w-5 h-5" />,
  'PORCIONES': <UtensilsCrossed className="w-5 h-5" />,
  'BEBIDAS': <Coffee className="w-5 h-5" />,
  'EXTRAS': <Package className="w-5 h-5" />,
  'COMBOS': <ShoppingBag className="w-5 h-5" />
};

export function InventoryView({
  products,
  onUpdateStock,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct
}: InventoryViewProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('PLATOS FUERTES');
  const [stockEditMode, setStockEditMode] = useState<string | null>(null);
  const [stockEditValue, setStockEditValue] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filteredProducts = products.filter(p => p.category === activeCategory);
  const isEditingProduct = editingProductId !== null;

  const openCreateForm = () => {
    setEditingProductId(null);
    setForm({ ...emptyForm, category: activeCategory });
    setFormOpen(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      stock: product.stock.toString(),
      requiresPackaging: product.requiresPackaging
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingProductId(null);
    setForm(emptyForm);
  };

  const handleStartStockEdit = (productId: string, currentStock: number) => {
    setStockEditMode(productId);
    setStockEditValue(currentStock.toString());
  };

  const handleSaveStockEdit = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newStock = parseInt(stockEditValue, 10);
    if (isNaN(newStock) || newStock < 0) return;

    const change = newStock - product.stock;
    if (change !== 0) {
      await onUpdateStock(productId, change);
    }

    setStockEditMode(null);
    setStockEditValue('');
  };

  const handleQuickStockChange = async (productId: string, amount: number) => {
    await onUpdateStock(productId, amount);
  };

  const handleSaveProduct = async () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock, 10);

    if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) return;

    const input: ProductInput = {
      name,
      price,
      category: form.category,
      stock,
      requiresPackaging: form.requiresPackaging
    };

    setSaving(true);
    const success = isEditingProduct
      ? await onUpdateProduct(editingProductId, input)
      : await onCreateProduct(input);
    setSaving(false);

    if (success) {
      setActiveCategory(input.category);
      closeForm();
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(`Eliminar "${product.name}" del menu?`);
    if (!confirmed) return;

    await onDeleteProduct(product.id);
  };

  return (
    <div className="p-4 pb-20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-2xl font-bold mb-1">Productos</h2>
          <p className="text-gray-500 text-sm">Crea, edita y controla el stock del menu</p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-bold text-sm shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Nuevo
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-4 scrollbar-hide">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
              activeCategory === category
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {categoryIcons[category]}
            {category}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredProducts.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
            <Package className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold">No hay productos en esta categoria</p>
            <button
              onClick={openCreateForm}
              className="mt-4 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm font-semibold"
            >
              Agregar producto
            </button>
          </div>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h4 className="text-white font-semibold leading-snug">{product.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                    <span className="text-orange-400 font-bold">${product.price.toFixed(2)}</span>
                    {product.requiresPackaging && (
                      <span className="text-gray-500 text-xs">+${PACKAGING_FEE.toFixed(2)} envase</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {product.stock <= 0 ? (
                    <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      AGOTADO
                    </span>
                  ) : product.stock <= 5 ? (
                    <span className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      BAJO
                    </span>
                  ) : (
                    <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      OK
                    </span>
                  )}
                </div>
              </div>

              {stockEditMode === product.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={stockEditValue}
                    onChange={(e) => setStockEditValue(e.target.value)}
                    className="flex-1 bg-gray-700 text-white text-center text-xl font-bold p-3 rounded-xl border-2 border-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveStockEdit(product.id)}
                    className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-500"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setStockEditMode(null)}
                    className="p-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Stock:</span>
                    <span className={`text-2xl font-bold ${product.stock <= 0 ? 'text-red-400' : 'text-white'}`}>
                      {product.stock}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuickStockChange(product.id, -1)}
                      className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartStockEdit(product.id, product.stock)}
                      className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                    >
                      Stock
                    </button>
                    <button
                      onClick={() => handleQuickStockChange(product.id, 5)}
                      className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500"
                    >
                      +5
                    </button>
                    <button
                      onClick={() => openEditForm(product)}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product)}
                      className="p-2 bg-red-700 text-white rounded-lg hover:bg-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">
                {isEditingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h3>
              <button
                onClick={closeForm}
                disabled={saving}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Combo familiar"
                  className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-semibold mb-2">Precio</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-semibold mb-2">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as Category }))}
                  className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                >
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between gap-3 bg-gray-900/70 rounded-xl p-3 border border-gray-700">
                <div>
                  <span className="text-white font-semibold text-sm">Cobra envase</span>
                  <p className="text-gray-500 text-xs">Aplica +${PACKAGING_FEE.toFixed(2)} cuando va para llevar</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.requiresPackaging}
                  onChange={(e) => setForm(prev => ({ ...prev, requiresPackaging: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                />
              </label>

              <button
                onClick={handleSaveProduct}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-bold disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
