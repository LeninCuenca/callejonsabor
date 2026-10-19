// =====================================================
// VIEWS - Components - Menu de Productos (Redesigned)
// =====================================================

import { useState } from 'react';
import { Product, Category } from '../../models';
import { CATEGORIES, PACKAGING_FEE } from '../../controllers/productController';
import { Plus, Flame, UtensilsCrossed, Coffee, Package, ShoppingBag } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  cartQuantities?: Record<string, number>; // productId -> total qty in cart
}

const categoryIcons: Record<Category, React.ReactNode> = {
  'PLATOS FUERTES': <Flame className="w-4 h-4" />,
  'PORCIONES': <UtensilsCrossed className="w-4 h-4" />,
  'BEBIDAS': <Coffee className="w-4 h-4" />,
  'EXTRAS': <Package className="w-4 h-4" />,
  'COMBOS': <ShoppingBag className="w-4 h-4" />
};

const categoryEmoji: Record<Category, string> = {
  'PLATOS FUERTES': '🍽️',
  'PORCIONES': '🥘',
  'BEBIDAS': '🥤',
  'EXTRAS': '🛍️',
  'COMBOS': '🍱'
};

const categoryConfig: Record<Category, {
  gradient: string;
  activeBg: string;
  cardAccent: string;
  priceGradient: string;
  glowColor: string;
  iconBg: string;
}> = {
  'PLATOS FUERTES': {
    gradient: 'from-red-500 to-orange-500',
    activeBg: 'bg-gradient-to-r from-red-500 to-orange-500',
    cardAccent: 'border-red-500/40 hover:border-red-400/80',
    priceGradient: 'from-red-500 to-orange-400',
    glowColor: 'shadow-red-500/20',
    iconBg: 'bg-red-500/20 text-red-400',
  },
  'PORCIONES': {
    gradient: 'from-amber-500 to-yellow-400',
    activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    cardAccent: 'border-amber-500/40 hover:border-amber-400/80',
    priceGradient: 'from-amber-500 to-yellow-400',
    glowColor: 'shadow-amber-500/20',
    iconBg: 'bg-amber-500/20 text-amber-400',
  },
  'BEBIDAS': {
    gradient: 'from-sky-500 to-blue-400',
    activeBg: 'bg-gradient-to-r from-sky-500 to-blue-400',
    cardAccent: 'border-sky-500/40 hover:border-sky-400/80',
    priceGradient: 'from-sky-500 to-blue-400',
    glowColor: 'shadow-sky-500/20',
    iconBg: 'bg-sky-500/20 text-sky-400',
  },
  'EXTRAS': {
    gradient: 'from-purple-500 to-violet-400',
    activeBg: 'bg-gradient-to-r from-purple-500 to-violet-400',
    cardAccent: 'border-purple-500/40 hover:border-purple-400/80',
    priceGradient: 'from-purple-500 to-violet-400',
    glowColor: 'shadow-purple-500/20',
    iconBg: 'bg-purple-500/20 text-purple-400',
  },
  'COMBOS': {
    gradient: 'from-emerald-500 to-teal-400',
    activeBg: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    cardAccent: 'border-emerald-500/40 hover:border-emerald-400/80',
    priceGradient: 'from-emerald-500 to-teal-400',
    glowColor: 'shadow-emerald-500/20',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
  }
};

export function ProductGrid({ products, onAddProduct, cartQuantities = {} }: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('PLATOS FUERTES');
  const [addedId, setAddedId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => p.category === activeCategory);
  const config = categoryConfig[activeCategory];

  const handleAdd = (product: Product) => {
    if (product.stock <= 0) return;
    onAddProduct(product);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 600);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">

      {/* ── Category tabs ── */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-gray-950">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(category => {
            const cfg = categoryConfig[category];
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                style={{ scrollSnapAlign: 'start' }}
                className={`
                  flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl
                  font-semibold text-xs whitespace-nowrap transition-all duration-250
                  ${isActive
                    ? `${cfg.activeBg} text-white shadow-lg shadow-black/30`
                    : 'bg-gray-800/70 text-gray-400 hover:bg-gray-700/70 hover:text-gray-200'
                  }
                `}
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded-full transition-all ${isActive ? 'bg-white/20' : cfg.iconBg}`}>
                  {categoryIcons[category]}
                </span>
                <span className="hidden sm:inline">{category}</span>
                <span className="sm:hidden">{categoryEmoji[category]}</span>
              </button>
            );
          })}
        </div>

        {/* Active category label */}
        <div className="flex items-center gap-2 mt-2 mb-0.5 px-0.5">
          <div className={`w-1 h-4 rounded-full bg-gradient-to-b ${config.gradient}`} />
          <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
            {activeCategory}
          </span>
          <span className="ml-auto text-xs text-gray-600 font-medium">
            {filteredProducts.filter(p => p.stock > 0).length} disponibles
          </span>
        </div>
      </div>

      {/* ── Product grid ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <ShoppingBag className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm font-medium">Sin productos en esta categoría</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {filteredProducts.map(product => {
              const isOutOfStock = product.stock <= 0;
              const cfg = categoryConfig[product.category];
              const isJustAdded = addedId === product.id;
              const cartQty = cartQuantities[product.id] ?? 0;
              const inCart = cartQty > 0;

              return (
                <button
                  key={product.id}
                  onClick={() => handleAdd(product)}
                  disabled={isOutOfStock}
                  className={`
                    relative flex flex-col rounded-2xl border overflow-hidden
                    transition-all duration-200 text-left
                    ${isOutOfStock
                      ? 'bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed'
                      : `bg-gray-900 ${
                          inCart
                            ? `border-orange-400/70 shadow-lg shadow-orange-500/15`
                            : cfg.cardAccent
                        } cursor-pointer
                         hover:scale-[1.02] hover:shadow-xl hover:${cfg.glowColor}
                         active:scale-[0.97]`
                    }
                    ${isJustAdded ? 'scale-[0.96] border-white/50' : ''}
                  `}
                >
                  {/* AGOTADO overlay */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center z-10">
                      <span className="bg-red-700/90 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase shadow">
                        Agotado
                      </span>
                    </div>
                  )}

                  {/* ── Card top accent strip ── */}
                  <div className={`h-1 w-full bg-gradient-to-r ${cfg.gradient} flex-shrink-0`} />

                  {/* ── Card body ── */}
                  <div className="flex flex-col flex-1 p-3 gap-2">
                    {/* Icon + add button row */}
                    <div className="flex items-start justify-between">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cfg.iconBg} text-lg`}>
                        {categoryEmoji[product.category]}
                      </div>

                      {!isOutOfStock && inCart ? (
                        <div
                          className={`
                            min-w-7 h-7 px-2 rounded-full flex items-center justify-center flex-shrink-0
                            text-xs font-black text-white bg-gradient-to-br from-orange-500 to-red-500
                            shadow-md shadow-orange-500/40 transition-transform duration-150
                            ${isJustAdded ? 'scale-110' : 'scale-100'}
                          `}
                        >
                          {cartQty}
                        </div>
                      ) : !isOutOfStock && (
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                          bg-gradient-to-br ${cfg.gradient} shadow-sm
                          transition-transform duration-150
                          ${isJustAdded ? 'scale-125' : 'scale-100'}
                        `}>
                          <Plus className="w-3.5 h-3.5 text-white stroke-[3px]" />
                        </div>
                      )}
                    </div>

                    {/* Product name */}
                    <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>

                    {/* Price + stock row */}
                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <span className={`
                          text-base font-extrabold tracking-tight
                          bg-gradient-to-r ${cfg.priceGradient} bg-clip-text text-transparent
                        `}>
                          ${product.price.toFixed(2)}
                        </span>
                        {product.requiresPackaging && (
                          <p className="text-[9px] text-gray-600 leading-none mt-0.5">
                            +${PACKAGING_FEE.toFixed(2)} envase
                          </p>
                        )}
                      </div>

                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isOutOfStock
                          ? 'bg-red-900/40 text-red-400'
                          : product.stock <= 3
                          ? 'bg-amber-900/40 text-amber-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {isOutOfStock ? '\u2715' : `\u00d7${product.stock}`}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
