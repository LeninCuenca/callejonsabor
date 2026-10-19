// =====================================================
// VIEWS - Components - Carrito de Pedidos
// =====================================================

import { CartItem } from '../../models';
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';

interface CartViewProps {
  items: CartItem[];
  subtotal: number;
  packagingFee: number;
  total: number;
  orderType: 'dine_in' | 'takeaway';
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onToggleTakeaway: (itemId: string) => void;
}

export function CartView({
  items,
  subtotal,
  packagingFee,
  total,
  orderType,
  onIncrement,
  onDecrement,
  onRemove,
  onToggleTakeaway
}: CartViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6">
        <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-center font-medium">Carrito vacio</p>
        <p className="text-sm text-center mt-1">Toca un producto para agregarlo</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="p-3">
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="bg-gray-800 rounded-xl p-3 border border-gray-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-sm truncate">
                    {item.product.name}
                  </h4>
                  <p className="text-gray-400 text-xs">{item.product.category}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="text-gray-400">
                      ${item.unitPrice.toFixed(2)} c/u
                    </span>
                    {item.packagingSurcharge > 0 && (
                      <span className="text-orange-400">
                        +${item.packagingSurcharge.toFixed(2)} envase
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onRemove(item.id)}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 bg-gray-900 rounded-lg">
                  <button
                    onClick={() => onDecrement(item.id)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-l-lg transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-white font-bold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onIncrement(item.id)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-r-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-white font-bold text-lg">
                  ${item.itemTotal.toFixed(2)}
                </span>
              </div>

              {orderType === 'dine_in' && item.product.category === 'PLATOS FUERTES' && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.isTakeaway}
                    onChange={() => onToggleTakeaway(item.id)}
                    className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-gray-400">Para llevar (+${(item.quantity * 0.25).toFixed(2)})</span>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-gray-700 bg-gray-900/50">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {packagingFee > 0 && (
            <div className="flex justify-between text-orange-400">
              <span>Cargo por envases:</span>
              <span>+${packagingFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-white text-xl font-bold pt-2 border-t border-gray-700">
            <span>TOTAL:</span>
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
