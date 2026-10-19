// =====================================================
// APP - Main Application Component
// =====================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Flame, BarChart3, Clock, History, TrendingUp, Package, X, Check, UtensilsCrossed, Smartphone } from 'lucide-react';

import { Order, CartItem, Product, PaymentMethod } from './models';
import { useProductController, PACKAGING_FEE } from './controllers/productController';
import { useOrderController } from './controllers/orderController';
import { useStatisticsController } from './controllers/statisticsController';

import { ProductGrid } from './components/Menu/ProductGrid';
import { CartView } from './components/Cart/CartView';
import { ActiveOrdersList } from './components/ActivyOrdes/ActiveOrdersList';
import { PaymentView } from './components/Paymen/PaymentView';
import { AddItemsView } from './components/Paymen/AddItemsView';
import { DashboardView } from './components/Dasboard/DashboardView';
import { HistoryView } from './components/History/HistoryView';
import { StatisticsView } from './components/Statistics/StatisticsView';
import { InventoryView } from './components/Inventory/InventoryView';
import logo from './logo.png';

type MainTab = 'pos' | 'active' | 'history' | 'dashboard' | 'statistics' | 'inventory';
const POS_DRAFT_STORAGE_KEY = 'callejon-pos-draft';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface POSViewProps {
  products: Product[];
  isInStock: (productId: string) => boolean;
  fetchProducts: () => Promise<void>;
  createOrder: (
    items: { product: Product; quantity: number; isTakeaway: boolean }[],
    orderType: 'dine_in' | 'takeaway',
    tableNumber?: number
  ) => Promise<Order | null>;
  loading: boolean;
}

interface POSDraft {
  cartItems: CartItem[];
  orderType: 'dine_in' | 'takeaway';
  tableNumber?: number;
}

function loadPOSDraft(): POSDraft {
  try {
    const rawDraft = localStorage.getItem(POS_DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      return { cartItems: [], orderType: 'dine_in' };
    }

    const parsed = JSON.parse(rawDraft) as Partial<POSDraft>;
    return {
      cartItems: Array.isArray(parsed.cartItems) ? parsed.cartItems : [],
      orderType: parsed.orderType === 'takeaway' ? 'takeaway' : 'dine_in',
      tableNumber: typeof parsed.tableNumber === 'number' ? parsed.tableNumber : undefined
    };
  } catch {
    return { cartItems: [], orderType: 'dine_in' };
  }
}

function POSView({ products, isInStock, fetchProducts, createOrder, loading }: POSViewProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadPOSDraft().cartItems);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>(() => loadPOSDraft().orderType);
  const [tableNumber, setTableNumber] = useState<number | undefined>(() => loadPOSDraft().tableNumber);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    localStorage.setItem(POS_DRAFT_STORAGE_KEY, JSON.stringify({
      cartItems,
      orderType,
      tableNumber
    }));
  }, [cartItems, orderType, tableNumber]);

  const handleSetOrderType = (type: 'dine_in' | 'takeaway') => {
    setOrderType(type);
    setCartItems(prev => prev.map(item => {
      const isTakeaway = type === 'takeaway' ? true : false;
      const packagingSurcharge = isTakeaway && item.product.requiresPackaging ? PACKAGING_FEE * item.quantity : 0;
      return {
        ...item,
        isTakeaway,
        packagingSurcharge,
        itemTotal: item.product.price * item.quantity + packagingSurcharge
      };
    }));
  };

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const packagingFee = cartItems.reduce((sum, item) => sum + item.packagingSurcharge, 0);
    return { subtotal, packagingFee, total: subtotal + packagingFee };
  }, [cartItems]);

  const handleAddProduct = useCallback((product: Product) => {
    if (!isInStock(product.id)) return;

    const existingItem = cartItems.find(item => item.product.id === product.id && item.isTakeaway === (orderType === 'takeaway'));

    if (existingItem) {
      setCartItems(prev => prev.map(item =>
        item.id === existingItem.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              packagingSurcharge: item.isTakeaway && product.requiresPackaging ? item.packagingSurcharge + PACKAGING_FEE : item.packagingSurcharge,
              itemTotal: item.itemTotal + product.price + (item.isTakeaway && product.requiresPackaging ? PACKAGING_FEE : 0)
            }
          : item
      ));
    } else {
      const isTakeaway = orderType === 'takeaway';
      const packagingSurcharge = isTakeaway && product.requiresPackaging ? PACKAGING_FEE : 0;

      setCartItems(prev => [...prev, {
        id: generateId(),
        product,
        quantity: 1,
        unitPrice: product.price,
        packagingSurcharge,
        itemTotal: product.price + packagingSurcharge,
        isTakeaway
      }]);
    }
  }, [orderType, isInStock, cartItems]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const handleIncrement = useCallback((itemId: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQuantity = item.quantity + 1;
      const packagingSurcharge = item.isTakeaway && item.product.requiresPackaging ? PACKAGING_FEE * newQuantity : 0;
      return {
        ...item,
        quantity: newQuantity,
        packagingSurcharge,
        itemTotal: item.product.price * newQuantity + packagingSurcharge
      };
    }));
  }, []);

  const handleDecrement = useCallback((itemId: string) => {
    setCartItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item || item.quantity <= 1) {
        return prev.filter(i => i.id !== itemId);
      }
      const newQuantity = item.quantity - 1;
      const packagingSurcharge = item.isTakeaway && item.product.requiresPackaging ? PACKAGING_FEE * newQuantity : 0;
      return prev.map(i => i.id === itemId ? {
        ...item,
        quantity: newQuantity,
        packagingSurcharge,
        itemTotal: item.product.price * newQuantity + packagingSurcharge
      } : i);
    });
  }, []);

  const handleToggleTakeaway = useCallback((itemId: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newIsTakeaway = !item.isTakeaway;
      const packagingSurcharge = newIsTakeaway && item.product.requiresPackaging ? PACKAGING_FEE * item.quantity : 0;
      return {
        ...item,
        isTakeaway: newIsTakeaway,
        packagingSurcharge,
        itemTotal: item.product.price * item.quantity + packagingSurcharge
      };
    }));
  }, []);

  const handleConfirmOrder = async () => {
    if (cartItems.length === 0) return;
    if (orderType === 'dine_in' && !tableNumber) {
      setShowOrderTypeModal(true);
      return;
    }

    const itemsToCreate = cartItems.map(item => ({
      product: item.product,
      quantity: item.quantity,
      isTakeaway: item.isTakeaway
    }));

    const success = await createOrder(itemsToCreate, orderType, tableNumber);

    if (success) {
      localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
      setCartItems([]);
      setTableNumber(undefined);
      setShowSuccess(true);
      fetchProducts();
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="bg-gradient-to-r from-red-700 via-red-600 to-orange-600 px-4 pb-4 shadow-lg flex-shrink-0 safe-area-pt">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-12 h-12 object-contain rounded-xl bg-white/10 p-0.5" />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Callejón del Sabor</h1>
              <p className="text-white/70 text-xs">Punto de Venta</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Menú de productos */}
        <ProductGrid
          products={products}
          onAddProduct={handleAddProduct}
          cartQuantities={Object.fromEntries(
            cartItems.map(item => [item.product.id, item.quantity])
          )}
        />

        {/* Selector de tipo de pedido */}
        <div className="bg-gray-900 border-t border-gray-700">
          <div className="flex items-center gap-2 p-3 bg-gray-800">
            <button
              onClick={() => handleSetOrderType('dine_in')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-semibold transition-all ${
                orderType === 'dine_in'
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <UtensilsCrossed className="w-5 h-5" />
              En Local
            </button>
            <button
              onClick={() => handleSetOrderType('takeaway')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-semibold transition-all ${
                orderType === 'takeaway'
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              Llevar
            </button>
          </div>

          {orderType === 'dine_in' && (
            <div className="px-3 pb-2">
              <input
                type="number"
                min="1"
                max="99"
                value={tableNumber ?? ''}
                onChange={(e) => setTableNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Numero de Mesa"
                className="w-full bg-gray-700 text-white text-center font-bold p-2 rounded-xl border-2 border-gray-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
          )}

          {/* Carrito */}
          <CartView
            items={cartItems}
            subtotal={totals.subtotal}
            packagingFee={totals.packagingFee}
            total={totals.total}
            orderType={orderType}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemoveItem}
            onToggleTakeaway={handleToggleTakeaway}
          />

          {/* Botón crear pedido */}
          <div className="p-3 border-t border-gray-700">
            {orderType === 'takeaway' && totals.packagingFee > 0 && (
              <p className="text-orange-400 text-xs text-center mb-2">
                +${totals.packagingFee.toFixed(2)} cargo por envases
              </p>
            )}
            <button
              onClick={handleConfirmOrder}
              disabled={cartItems.length === 0 || loading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                cartItems.length > 0 && !loading
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg active:scale-[0.98]'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Guardando...' : `Crear Pedido - $${totals.total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>

      {showOrderTypeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Ingresa Mesa</h3>
              <button onClick={() => setShowOrderTypeModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-300 mb-4">Debes ingresar el numero de mesa para pedidos en local.</p>
            <button
              onClick={() => setShowOrderTypeModal(false)}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl border border-white/20 animate-bounce-in">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
              <Check className="w-12 h-12 text-white stroke-[3px]" />
            </div>
            <h2 className="text-white text-3xl font-extrabold mb-3 tracking-wide drop-shadow-md">
              ¡Pedido Creado!
            </h2>
            <p className="text-white/95 text-base font-medium drop-shadow-sm">
              El pedido se ha enviado a cocina correctamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('pos');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showAddItems, setShowAddItems] = useState(false);
  const [showPaidSuccess, setShowPaidSuccess] = useState(false);

  const {
    products,
    updateStock,
    createProduct,
    updateProduct,
    deleteProduct,
    fetchProducts,
    isInStock,
    loading: productsLoading
  } = useProductController();
  const {
    orders,
    loading: ordersLoading,
    fetchOrders,
    createOrder,
    addItemsToOrder,
    removeItemFromOrder,
    processPayment,
    correctPaymentMethod,
    finalizeOrder
  } = useOrderController();

  const { calculateDailySummary, getTopSellingProducts, getLeastSellingProducts } = useStatisticsController(orders);

  const summary = calculateDailySummary();
  const topProducts = getTopSellingProducts(5);
  const leastProducts = getLeastSellingProducts(5);

  const handleAddItemsToOrder = async (items: { product: Product; quantity: number; isTakeaway: boolean }[]): Promise<boolean> => {
    if (!selectedOrder) return false;
    const updatedOrder = await addItemsToOrder(selectedOrder.id, items);
    if (updatedOrder) {
      fetchProducts();
      setSelectedOrder(updatedOrder);
      return true;
    }
    return false;
  };

  const handleProcessPayment = async (amount: number, method: PaymentMethod, itemIds: string[], receiptPhoto?: string, itemPayments?: { id: string; qty: number }[], splitPayments?: { amount: number; method: PaymentMethod; receiptPhotoUrl?: string }[]) => {
    if (!selectedOrder) return false;
    const updatedOrder = await processPayment(selectedOrder.id, amount, method, itemIds, receiptPhoto, itemPayments, splitPayments);
    if (updatedOrder) {
      if (updatedOrder.status === 'completed' || updatedOrder.balance <= 0) {
        // Automatically close the modal when paid in full
        setSelectedOrder(null);
        // Show paid success animation
        setShowPaidSuccess(true);
        setTimeout(() => setShowPaidSuccess(false), 2000);
      } else {
        // Update the modal details with the new balance/paid items
        setSelectedOrder(updatedOrder);
      }
      return true;
    }
    return false;
  };

  const handleRemoveItemFromOrder = async (itemId: string): Promise<boolean> => {
    if (!selectedOrder) return false;
    const updatedOrder = await removeItemFromOrder(selectedOrder.id, itemId);
    if (updatedOrder) {
      setSelectedOrder(updatedOrder);
      return true;
    }
    return false;
  };

  const handleFinalizeOrder = async () => {
    if (!selectedOrder) return false;
    const success = await finalizeOrder(selectedOrder.id);
    if (success) {
      setSelectedOrder(null);
      fetchOrders();
    }
    return success;
  };

  const handleCorrectPayment = async (paymentId: string, newMethod: PaymentMethod, receiptPhotoUrl?: string): Promise<boolean> => {
    if (!selectedOrder) return false;
    const ok = await correctPaymentMethod(paymentId, newMethod, receiptPhotoUrl);
    if (ok) {
      // Refresh the selectedOrder from the updated orders list
      const refreshed = orders.find(o => o.id === selectedOrder.id);
      if (refreshed) setSelectedOrder({ ...refreshed });
    }
    return ok;
  };

  const navItems: { id: MainTab; icon: React.ReactNode; label: string }[] = [
    { id: 'pos', icon: <Flame className="w-5 h-5" />, label: 'POS' },
    { id: 'active', icon: <Clock className="w-5 h-5" />, label: 'Pedidos' },
    { id: 'history', icon: <History className="w-5 h-5" />, label: 'Historial' },
    { id: 'dashboard', icon: <BarChart3 className="w-5 h-5" />, label: 'Caja' },
    { id: 'statistics', icon: <TrendingUp className="w-5 h-5" />, label: 'Estad' },
    { id: 'inventory', icon: <Package className="w-5 h-5" />, label: 'Invent' }
  ];

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <main className="flex-1 overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] flex flex-col">
        {activeTab === 'pos' && (
          <POSView
            products={products}
            isInStock={isInStock}
            fetchProducts={fetchProducts}
            createOrder={createOrder}
            loading={ordersLoading || productsLoading}
          />
        )}

        {activeTab === 'active' && !selectedOrder && (
          <div className="flex-1 overflow-y-auto safe-area-pt">
            <ActiveOrdersList
              orders={orders}
              onSelectOrder={(order) => setSelectedOrder(order)}
            />
          </div>
        )}

        {activeTab === 'active' && selectedOrder && showAddItems && (
          <AddItemsView
            order={selectedOrder}
            products={products}
            onAddItems={handleAddItemsToOrder}
            onClose={() => setShowAddItems(false)}
          />
        )}

        {activeTab === 'active' && selectedOrder && !showAddItems && (
          <PaymentView
            order={selectedOrder}
            onProcessPayment={handleProcessPayment}
            onAddItems={() => setShowAddItems(true)}
            onRemoveItem={handleRemoveItemFromOrder}
            onFinalize={handleFinalizeOrder}
            onCorrectPayment={handleCorrectPayment}
            onClose={() => setSelectedOrder(null)}
            loading={ordersLoading}
          />
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto safe-area-pt">
            <HistoryView orders={orders} />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto safe-area-pt">
            <DashboardView summary={summary} orders={orders} loading={ordersLoading} />
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="flex-1 overflow-y-auto safe-area-pt">
            <StatisticsView
              topProducts={topProducts}
              leastProducts={leastProducts}
              products={products}
            />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="flex-1 overflow-y-auto safe-area-pt">
            <InventoryView
              products={products}
              onUpdateStock={updateStock}
              onCreateProduct={createProduct}
              onUpdateProduct={updateProduct}
              onDeleteProduct={deleteProduct}
            />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-2 pt-2 safe-area-pb z-40">
        <div className="flex justify-around max-w-lg mx-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSelectedOrder(null);
              }}
              className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
                activeTab === item.id ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              {activeTab === item.id && (
                <div className="w-1 h-1 bg-orange-400 rounded-full mt-0.5" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {showPaidSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-gradient-to-br from-green-600 via-emerald-500 to-teal-500 rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl border border-white/20 animate-bounce-in">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
              <Check className="w-12 h-12 text-white stroke-[3px]" />
            </div>
            <h2 className="text-white text-3xl font-extrabold mb-3 tracking-wide drop-shadow-md">
              ¡Pago Completado!
            </h2>
            <p className="text-white/95 text-base font-medium drop-shadow-sm">
              El pedido ha sido cobrado y finalizado con éxito.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


export default App;
