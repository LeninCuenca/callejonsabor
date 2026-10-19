// =====================================================
// VIEWS - Components - Agregar Mas Productos a un Pedido
// =====================================================

import { useState, useMemo, useCallback } from 'react';
import { Product, Category, Order } from '../../models';
import { CATEGORIES, PACKAGING_FEE } from '../../controllers/productController';
import { ArrowLeft, Plus, Minus, Trash2, Search, Flame, UtensilsCrossed, Coffee, Package, ShoppingBag } from 'lucide-react';

interface AddItemsViewProps {
  order: Order;
  products: Product[];
  onAddItems: (
    items: { product: Product; quantity: number; isTakeaway: boolean }[]
  ) => Promise<boolean>;
  onClose: () => void;
}

interface AddedItem {
  id: string;
  product: Product;
  quantity: number;
  isTakeaway: boolean;
}

const categoryIcons: Record<Category, React.ReactNode> = {
  'PLATOS FUERTES': <Flame className="w-4 h-4" />,
  'PORCIONES': <UtensilsCrossed className="w-4 h-4" />,
  'BEBIDAS': <Coffee className="w-4 h-4" />,
  'EXTRAS': <Package className="w-4 h-4" />,
  'COMBOS': <ShoppingBag className="w-4 h-4" />
};

const categoryColors: Record<Category, string> = {
  'PLATOS FUERTES': 'from-red-600 to-orange-500',
  'PORCIONES': 'from-amber-600 to-yellow-500',
  'BEBIDAS': 'from-orange-500 to-amber-400',
  'EXTRAS': 'from-gray-600 to-gray-500',
  'COMBOS': 'from-purple-600 to-indigo-500'
};

export function AddItemsView({ order, products, onAddItems, onClose }: AddItemsViewProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('PLATOS FUERTES');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar productos por categoría y query de búsqueda
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  // Consultar stock restante del producto restando lo que está en addedItems
  const getProductStock = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    
    const addedQty = addedItems
      .filter(item => item.product.id === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
      
    return Math.max(0, product.stock - addedQty);
  }, [products, addedItems]);

  const handleAddProduct = (product: Product) => {
    const remainingStock = getProductStock(product.id);
    if (remainingStock <= 0) return;

    const defaultIsTakeaway = order.orderType === 'takeaway';
    const existingIndex = addedItems.findIndex(
      item => item.product.id === product.id && item.isTakeaway === defaultIsTakeaway
    );

    if (existingIndex >= 0) {
      setAddedItems(prev => {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1
        };
        return next;
      });
    } else {
      setAddedItems(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          product,
          quantity: 1,
          isTakeaway: defaultIsTakeaway
        }
      ]);
    }
  };

  const handleIncrement = (itemId: string) => {
    const item = addedItems.find(i => i.id === itemId);
    if (!item) return;

    const remainingStock = getProductStock(item.product.id);
    if (remainingStock <= 0) return;

    setAddedItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i))
    );
  };

  const handleDecrement = (itemId: string) => {
    setAddedItems(prev =>
      prev
        .map(i => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter(i => i.quantity > 0)
    );
  };

  const handleRemove = (itemId: string) => {
    setAddedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleToggleTakeaway = (itemId: string) => {
    setAddedItems(prev =>
      prev.map(i => {
        if (i.id !== itemId) return i;
        return {
          ...i,
          isTakeaway: !i.isTakeaway
        };
      })
    );
  };

  // Calcular totales temporales de adición
  const totals = useMemo(() => {
    return addedItems.reduce(
      (acc, item) => {
        const itemBase = item.product.price * item.quantity;
        const itemPackaging = item.isTakeaway && item.product.requiresPackaging
          ? PACKAGING_FEE * item.quantity
          : 0;
        return {
          subtotal: acc.subtotal + itemBase,
          packagingFee: acc.packagingFee + itemPackaging,
          total: acc.total + itemBase + itemPackaging
        };
      },
      { subtotal: 0, packagingFee: 0, total: 0 }
    );
  }, [addedItems]);

  const handleSubmit = async () => {
    if (addedItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    
    const itemsToSubmit = addedItems.map(item => ({
      product: item.product,
      quantity: item.quantity,
      isTakeaway: item.isTakeaway
    }));

    const success = await onAddItems(itemsToSubmit);
    setIsSubmitting(false);
    
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col h-full">
      {/* Cabecera */}
      <header className="bg-gradient-to-r from-red-700 to-orange-600 px-4 pb-3 flex items-center justify-between flex-shrink-0 safe-area-pt">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-white font-bold text-base">Agregar Productos</h2>
            <p className="text-white/70 text-xs font-semibold">
              {order.orderType === 'dine_in' ? `Mesa ${order.tableNumber}` : 'Para Llevar'}
            </p>
          </div>
        </div>
      </header>

      {/* Cuerpo principal */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Panel Izquierdo - Menú */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-b md:border-b-0 md:border-r border-gray-800">
          <div className="p-3 bg-gray-900/50 flex flex-col gap-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs whitespace-nowrap transition-all ${
                    activeCategory === category
                      ? `bg-gradient-to-r ${categoryColors[category]} text-white shadow-md scale-105`
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  {categoryIcons[category]}
                  <span>{category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Listado de productos */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No se encontraron productos.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredProducts.map(product => {
                  const remainingStock = getProductStock(product.id);
                  const isOutOfStock = remainingStock <= 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => !isOutOfStock && handleAddProduct(product)}
                      disabled={isOutOfStock}
                      className={`relative text-left rounded-xl p-3 border transition-all ${
                        isOutOfStock
                          ? 'bg-gray-800/40 border-gray-800 opacity-40 cursor-not-allowed'
                          : 'bg-gray-800 border-gray-700 hover:border-orange-500 active:scale-95'
                      }`}
                    >
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            SIN STOCK
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">
                          {product.category}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Stock: {remainingStock}
                        </span>
                      </div>

                      <h3 className="text-white text-xs font-semibold leading-tight line-clamp-2 min-h-[32px] mb-2">
                        {product.name}
                      </h3>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs font-bold text-white">
                          ${product.price.toFixed(2)}
                        </span>
                        {!isOutOfStock && (
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${categoryColors[product.category]} flex items-center justify-center`}>
                            <Plus className="w-3.5 h-3.5 text-white stroke-[3px]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho - Resumen de Adiciones */}
        <div className="w-full md:w-80 bg-gray-950 flex flex-col h-72 md:h-full overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-950">
            <span className="text-white font-bold text-xs">Productos a agregar ({addedItems.reduce((s, i) => s + i.quantity, 0)})</span>
            {addedItems.length > 0 && (
              <button
                onClick={() => setAddedItems([])}
                className="text-gray-400 hover:text-red-400 text-xs font-medium"
              >
                Vaciar
              </button>
            )}
          </div>

          {/* Listado en carrito temporal */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
            {addedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-550 p-4">
                <p className="text-xs">Selecciona productos de la izquierda para agregarlos al pedido.</p>
              </div>
            ) : (
              addedItems.map(item => {
                const itemTotal = (item.product.price * item.quantity) + 
                  (item.isTakeaway && item.product.requiresPackaging ? PACKAGING_FEE * item.quantity : 0);
                
                return (
                  <div key={item.id} className="bg-gray-800 rounded-xl p-2.5 border border-gray-700/50 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <h4 className="text-white text-xs font-semibold leading-tight line-clamp-1">{item.product.name}</h4>
                        <span className="text-[10px] text-gray-500 font-bold">${item.product.price.toFixed(2)} c/u</span>
                      </div>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-gray-500 hover:text-red-400 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleTakeaway(item.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                          item.isTakeaway
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-gray-700 text-gray-400 border border-transparent'
                        }`}
                      >
                        {item.isTakeaway ? 'Para Llevar' : 'En Local'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecrement(item.id)}
                          className="w-5 h-5 bg-gray-700 hover:bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-extrabold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white text-xs font-bold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleIncrement(item.id)}
                          className="w-5 h-5 bg-gray-700 hover:bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-extrabold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {item.isTakeaway && item.product.requiresPackaging && (
                      <p className="text-[9px] text-orange-400/80 -mt-1 font-semibold">
                        +${(PACKAGING_FEE * item.quantity).toFixed(2)} por envases
                      </p>
                    )}

                    <div className="border-t border-gray-700/50 pt-1.5 flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 font-semibold">Subtotal:</span>
                      <span className="text-white font-bold">${itemTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer de acción */}
          <div className="p-3 border-t border-gray-800 bg-gray-900 flex-shrink-0">
            {totals.packagingFee > 0 && (
              <p className="text-[10px] text-orange-400 text-center mb-1.5 font-semibold">
                +${totals.packagingFee.toFixed(2)} cargo por envases
              </p>
            )}
            
            <button
              onClick={handleSubmit}
              disabled={addedItems.length === 0 || isSubmitting}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                addedItems.length > 0 && !isSubmitting
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md active:scale-98'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Agregando...' : `Confirmar Adición - $${totals.total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
