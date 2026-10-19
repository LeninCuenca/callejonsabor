// =====================================================
// VIEWS - Components - Pedidos Activos con Buscador
// =====================================================

import { useState, useMemo } from 'react';
import { Order } from '../../models';
import {
  UtensilsCrossed,
  Package,
  Clock,
  Plus,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface ActiveOrdersListProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

type FilterType = 'all' | 'dine_in' | 'takeaway' | 'unpaid' | 'paid';

function formatTimeAgo(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins === 1) return '1 min';
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  } catch {
    return '';
  }
}

export function ActiveOrdersList({ orders, onSelectOrder }: ActiveOrdersListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedTableShortcut, setSelectedTableShortcut] = useState<number | null>(null);

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status === 'active');
  }, [orders]);

  // Unique active tables for quick one-tap shortcuts
  const activeTables = useMemo(() => {
    const tables = new Set<number>();
    activeOrders.forEach(o => {
      if (o.orderType === 'dine_in' && o.tableNumber) {
        tables.add(o.tableNumber);
      }
    });
    return Array.from(tables).sort((a, b) => a - b);
  }, [activeOrders]);

  // Totals
  const totalPendingBalance = useMemo(() => {
    return activeOrders.reduce((sum, o) => sum + (o.balance > 0 ? o.balance : 0), 0);
  }, [activeOrders]);

  const dineInCount = useMemo(() => activeOrders.filter(o => o.orderType === 'dine_in').length, [activeOrders]);
  const takeawayCount = useMemo(() => activeOrders.filter(o => o.orderType === 'takeaway').length, [activeOrders]);
  const unpaidCount = useMemo(() => activeOrders.filter(o => o.balance > 0).length, [activeOrders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return activeOrders.filter(order => {
      // Filter by category chip
      if (filterType === 'dine_in' && order.orderType !== 'dine_in') return false;
      if (filterType === 'takeaway' && order.orderType !== 'takeaway') return false;
      if (filterType === 'unpaid' && order.balance <= 0) return false;
      if (filterType === 'paid' && order.balance > 0) return false;

      // Filter by table shortcut
      if (selectedTableShortcut !== null) {
        if (order.orderType !== 'dine_in' || order.tableNumber !== selectedTableShortcut) {
          return false;
        }
      }

      // Filter by search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();

        // 1. Table number match
        if (order.tableNumber !== undefined && order.tableNumber !== null) {
          const t = order.tableNumber.toString();
          if (t === q || `mesa ${t}`.includes(q) || `m${t}` === q || t.includes(q)) {
            return true;
          }
        }

        // 2. Order type match
        if (order.orderType === 'takeaway' && ('llevar'.includes(q) || 'para llevar'.includes(q) || 'takeaway'.includes(q))) {
          return true;
        }
        if (order.orderType === 'dine_in' && ('mesa'.includes(q) || 'local'.includes(q))) {
          return true;
        }

        // 3. Products in order match
        const hasMatchingProduct = order.items.some(item =>
          (item.productName || '').toLowerCase().includes(q)
        );
        if (hasMatchingProduct) return true;

        // 4. Match ID
        if (order.id.toLowerCase().includes(q)) return true;

        return false;
      }

      return true;
    });
  }, [activeOrders, filterType, selectedTableShortcut, searchQuery]);

  if (activeOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-500 px-4 text-center">
        <div className="w-16 h-16 bg-gray-800/80 rounded-2xl flex items-center justify-center mb-4 border border-gray-700/50">
          <Clock className="w-8 h-8 text-orange-400 opacity-60" />
        </div>
        <p className="font-semibold text-gray-300 text-lg">No hay pedidos activos</p>
        <p className="text-sm mt-1 text-gray-500 max-w-xs">
          Crea un nuevo pedido desde la pestaña POS para comenzar
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto flex flex-col gap-3">
      {/* ── Header Summary ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          <h3 className="text-white font-bold text-lg sm:text-xl flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" />
            Pedidos Activos
            <span className="bg-orange-500/20 text-orange-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-orange-500/30">
              {activeOrders.length}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Selecciona una orden para ver detalles, agregar platos o cobrar
          </p>
        </div>

        {totalPendingBalance > 0 && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Por Cobrar</span>
              <span className="text-red-400 font-extrabold text-sm sm:text-base">
                ${totalPendingBalance.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-orange-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por mesa (ej. 3), llevar, o plato (ej. chuleta)..."
          className="w-full pl-10 pr-10 py-2.5 bg-gray-800/90 text-white placeholder-gray-400 text-sm rounded-xl border border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            title="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Quick Table Shortcuts (One-tap select) ── */}
      {activeTables.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
          <span className="text-gray-400 font-medium whitespace-nowrap mr-1 flex items-center gap-1 text-[11px]">
            <Sparkles className="w-3 h-3 text-amber-400" /> Mesas:
          </span>
          {activeTables.map(table => {
            const isSelected = selectedTableShortcut === table;
            return (
              <button
                key={table}
                onClick={() => setSelectedTableShortcut(isSelected ? null : table)}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-amber-500 text-gray-950 border-amber-400 shadow-md shadow-amber-500/20 scale-105'
                    : 'bg-gray-800 text-amber-300 border-gray-700 hover:border-amber-500/50'
                }`}
              >
                Mesa {table}
              </button>
            );
          })}
          {selectedTableShortcut !== null && (
            <button
              onClick={() => setSelectedTableShortcut(null)}
              className="text-gray-400 hover:text-gray-200 text-[11px] underline ml-1 whitespace-nowrap"
            >
              Ver todas
            </button>
          )}
        </div>
      )}

      {/* ── Filter Pills ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
        <button
          onClick={() => { setFilterType('all'); setSelectedTableShortcut(null); }}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
            filterType === 'all' && selectedTableShortcut === null
              ? 'bg-gray-700 text-white border border-gray-600'
              : 'bg-gray-800/60 text-gray-400 hover:text-gray-200 border border-gray-800'
          }`}
        >
          Todos ({activeOrders.length})
        </button>

        <button
          onClick={() => setFilterType('dine_in')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            filterType === 'dine_in'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-gray-800/60 text-gray-400 hover:text-amber-300 border border-gray-800'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          Mesas ({dineInCount})
        </button>

        <button
          onClick={() => setFilterType('takeaway')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            filterType === 'takeaway'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
              : 'bg-gray-800/60 text-gray-400 hover:text-orange-300 border border-gray-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Llevar ({takeawayCount})
        </button>

        <button
          onClick={() => setFilterType('unpaid')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            filterType === 'unpaid'
              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
              : 'bg-gray-800/60 text-gray-400 hover:text-red-300 border border-gray-800'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          Por Cobrar ({unpaidCount})
        </button>
      </div>

      {/* ── Orders Grid ── */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-900/40 rounded-2xl border border-gray-800 text-center">
          <Search className="w-10 h-10 text-gray-600 mb-2" />
          <p className="text-gray-300 font-semibold text-sm">No se encontraron pedidos</p>
          <p className="text-gray-500 text-xs mt-1">
            {searchQuery
              ? `No hay resultados para "${searchQuery}"`
              : 'No hay pedidos activos en este filtro'}
          </p>
          {(searchQuery || filterType !== 'all' || selectedTableShortcut !== null) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setSelectedTableShortcut(null);
              }}
              className="mt-3 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-orange-400 text-xs font-semibold rounded-lg border border-gray-700 transition-all"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredOrders.map(order => {
            const isDineIn = order.orderType === 'dine_in';
            const paidItems = order.items.filter(i => i.paid).length;
            const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

            // Preview items string
            const itemsPreview = order.items
              .slice(0, 3)
              .map(i => `${i.quantity}x ${i.productName}`)
              .join(', ');
            const remainingItems = order.items.length - 3;

            return (
              <button
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className={`group rounded-2xl p-4 border transition-all duration-200 text-left flex flex-col justify-between relative overflow-hidden bg-gradient-to-b ${
                  isDineIn
                    ? 'from-gray-850 to-gray-900 border-amber-500/30 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10'
                    : 'from-gray-850 to-gray-900 border-orange-500/30 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10'
                }`}
              >
                {/* Top strip highlight */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isDineIn ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-orange-500 to-red-500'
                  }`}
                />

                <div>
                  {/* Header: Icon + Table/Takeaway + Time */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black shadow-md ${
                          isDineIn
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        }`}
                      >
                        {isDineIn ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-tighter text-amber-300">MESA</span>
                            <span className="text-base leading-none font-black">{order.tableNumber}</span>
                          </div>
                        ) : (
                          <Package className="w-5 h-5 text-orange-400" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black text-base sm:text-lg leading-tight ${
                              isDineIn ? 'text-amber-300' : 'text-orange-300'
                            }`}
                          >
                            {isDineIn ? `Mesa ${order.tableNumber}` : 'Para Llevar'}
                          </span>
                        </div>
                        <p className="text-gray-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {formatTimeAgo(order.createdAt)}
                          <span className="text-gray-600">•</span>
                          <span>{new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {order.balance <= 0 ? (
                      <span className="flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-green-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Pagado
                      </span>
                    ) : (
                      <span className="bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-500/30">
                        Saldo
                      </span>
                    )}
                  </div>

                  {/* Items preview list */}
                  <div className="bg-gray-950/60 rounded-xl p-2.5 mb-3 border border-gray-800">
                    <p className="text-gray-300 text-xs font-medium line-clamp-2 leading-relaxed">
                      {itemsPreview || 'Sin ítems'}
                      {remainingItems > 0 && (
                        <span className="text-orange-400 font-semibold"> +{remainingItems} más</span>
                      )}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1.5 pt-1 border-t border-gray-800/80">
                      <span>Total ítems: <strong className="text-gray-200">{totalItemsCount}</strong></span>
                      <span>
                        Pagados: <strong className={paidItems === order.items.length ? 'text-green-400' : 'text-gray-300'}>{paidItems}/{order.items.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Balance & Action Button */}
                <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total / Saldo</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-bold text-base sm:text-lg">
                        ${order.total.toFixed(2)}
                      </span>
                      {order.balance > 0 && order.balance !== order.total && (
                        <span className="text-xs text-red-400 font-semibold">
                          (Resta ${order.balance.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-transform group-hover:scale-105 shadow-md ${
                      order.balance > 0
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-gray-950'
                        : 'bg-gray-800 text-gray-300 border border-gray-700'
                    }`}
                  >
                    {order.balance > 0 ? (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cobrar</span>
                      </>
                    ) : (
                      <span>Ver</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
