// =====================================================
// VIEWS - Components - Pedidos Activos
// =====================================================

import { Order } from '../../models';
import { UtensilsCrossed, Package, Clock, Plus } from 'lucide-react';

interface ActiveOrdersListProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

export function ActiveOrdersList({ orders, onSelectOrder }: ActiveOrdersListProps) {
  const activeOrders = orders.filter(o => o.status === 'active');

  if (activeOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Clock className="w-12 h-12 mb-3 opacity-30" />
        <p className="font-medium">No hay pedidos activos</p>
        <p className="text-sm mt-1">Los nuevos pedidos apareceran aqui</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-400" />
        Pedidos Activos ({activeOrders.length})
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {activeOrders.map(order => {
          const unpaidItems = order.items.filter(i => !i.paid).length;
          const paidItems = order.items.filter(i => i.paid).length;

          return (
            <button
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-orange-500 transition-all text-left"
            >
              <div className="flex items-center gap-2 mb-3">
                {order.orderType === 'dine_in' ? (
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5 text-amber-400" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-orange-400" />
                  </div>
                )}

                <div>
                  {order.orderType === 'dine_in' ? (
                    <span className="text-amber-400 font-bold">Mesa {order.tableNumber}</span>
                  ) : (
                    <span className="text-orange-400 font-bold">Llevar</span>
                  )}
                  <p className="text-gray-500 text-xs">
                    {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Items:</span>
                  <span className="text-white">{order.items.length}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Pagados:</span>
                  <span className={paidItems === order.items.length ? 'text-green-400' : 'text-gray-300'}>
                    {paidItems}/{order.items.length}
                  </span>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Saldo:</span>
                  <span className={`font-bold ${order.balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    ${order.balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {unpaidItems > 0 && (
                <div className="mt-3 flex items-center justify-center gap-1 text-orange-400 text-xs">
                  <Plus className="w-3 h-3" />
                  <span>Toca para cobrar</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
