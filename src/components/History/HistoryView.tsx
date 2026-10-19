// =====================================================
// VIEWS - Components - Historial de Pedidos
// =====================================================

import { useState, useMemo } from 'react';
import { Order } from '../../models';
import { Calendar, ChevronLeft, ChevronRight, Eye, X, Banknote, Smartphone } from 'lucide-react';

interface HistoryViewProps {
  orders: Order[];
}

export function HistoryView({ orders }: HistoryViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'completed');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return completedOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= startOfDay && orderDate < endOfDay;
    });
  }, [completedOrders, currentDate]);

  const totalForDay = filteredOrders.reduce((sum, o) => sum + o.total, 0);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h2 className="text-white text-2xl font-bold mb-1">Historial</h2>
        <p className="text-gray-500 text-sm">Pedidos completados</p>
      </div>

      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="flex items-center gap-2 text-white"
          >
            <Calendar className="w-5 h-5 text-orange-400" />
            <span className="font-semibold">
              {isToday ? 'Hoy' : currentDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </button>

          <button
            onClick={() => navigateDate('next')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
          <span className="text-gray-400">Total del dia:</span>
          <span className="text-white text-xl font-bold">${totalForDay.toFixed(2)}</span>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No hay pedidos para esta fecha</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="w-full bg-gray-800 rounded-xl p-3 border border-gray-700 hover:border-orange-500 text-left transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">
                  {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-white font-bold">${order.total.toFixed(2)}</span>
              </div>

              <div className="text-gray-300 text-sm">
                {order.items.length} items - {order.orderType === 'dine_in' ? `Mesa ${order.tableNumber}` : 'Llevar'}
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 text-xs text-gray-500">
                <Eye className="w-4 h-4" />
                Ver detalle
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-bold">Detalle del Pedido</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4">
              <div className="bg-gray-700 rounded-xl p-3 mb-4">
                <p className="text-gray-400 text-sm mb-1">
                  {new Date(selectedOrder.createdAt).toLocaleString('es')}
                </p>
                <p className="text-white font-semibold">
                  {selectedOrder.orderType === 'dine_in' ? `Mesa ${selectedOrder.tableNumber}` : 'Para Llevar'}
                </p>
              </div>

              <h4 className="text-gray-400 text-xs uppercase font-semibold mb-2">Productos</h4>
              <div className="space-y-2 mb-4">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-white">{item.productName}</span>
                      <span className="text-gray-500 ml-2">x{item.quantity}</span>
                    </div>
                    <span className="text-gray-300">${item.itemTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-700 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal:</span>
                  <span>${selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrder.packagingFee > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Envases:</span>
                    <span>${selectedOrder.packagingFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold text-lg pt-2">
                  <span>Total:</span>
                  <span>${selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              <h4 className="text-gray-400 text-xs uppercase font-semibold mt-6 mb-2">Pagos Realizados</h4>
              <div className="space-y-2">
                {selectedOrder.payments.map(payment => (
                  <div key={payment.id} className="bg-gray-700 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {payment.paymentMethod === 'cash' ? (
                        <Banknote className="w-5 h-5 text-green-400" />
                      ) : (
                        <Smartphone className="w-5 h-5 text-blue-400" />
                      )}
                      <div>
                        <span className="text-white text-sm">
                          {payment.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                        </span>
                        <p className="text-gray-500 text-xs">
                          {new Date(payment.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-white font-bold">${payment.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {selectedOrder.closedAt && (
                <p className="text-gray-500 text-xs text-center mt-4">
                  Cerrado: {new Date(selectedOrder.closedAt).toLocaleString('es')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
