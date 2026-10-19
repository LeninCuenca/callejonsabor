// =====================================================
// VIEWS - Components - Dashboard de Cierre de Caja
// =====================================================

import { useEffect, useState, useMemo } from 'react';
import { DailySummary, Order } from '../../models';
import { db } from '../../lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { DollarSign, Banknote, Smartphone, Package, UtensilsCrossed, Receipt, TrendingUp, ShoppingCart, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Wallet, X } from 'lucide-react';

interface DashboardViewProps {
  summary?: DailySummary; // Mantener para compatibilidad de firma
  orders: Order[];
  loading: boolean;
}

interface MonthlySummary {
  year: number;
  month: number;
  monthName: string;
  totalSales: number;
  cashTotal: number;
  transferTotal: number;
  packagingFeesTotal: number;
  ordersCount: number;
  dineInCount: number;
  takeawayCount: number;
  itemsSold: number;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
  type?: 'expense' | 'loan_given' | 'loan_repaid';
}

const EXPENSE_CATEGORIES = ['Materia prima', 'Servicios', 'Sueldos', 'Arriendo', 'Transporte', 'Otros'];

function StatCard({
  icon,
  label,
  value,
  color,
  subtext
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 shadow-lg`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
        <span className="text-white/80 text-sm font-medium">{label}</span>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
      {subtext && <p className="text-white/60 text-xs mt-1">{subtext}</p>}
    </div>
  );
}

// Helper para calcular cierre diario dinámico
function calculateDailySummaryForDate(completedOrders: Order[], date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const dayOrders = completedOrders.filter(o => {
    const orderDate = new Date(o.createdAt);
    return orderDate >= startOfDay && orderDate < endOfDay;
  });

  const totalSales = dayOrders.reduce((sum, o) => sum + o.total, 0);
  const cashTotal = dayOrders.reduce((sum, o) => {
    const cashPayments = o.payments.filter(p => p.paymentMethod === 'cash');
    return sum + cashPayments.reduce((s, p) => s + p.amount, 0);
  }, 0);
  const transferTotal = dayOrders.reduce((sum, o) => {
    const transferPayments = o.payments.filter(p => p.paymentMethod === 'transfer');
    return sum + transferPayments.reduce((s, p) => s + p.amount, 0);
  }, 0);

  return {
    totalSales,
    cashTotal,
    transferTotal,
    packagingFeesTotal: dayOrders.reduce((sum, o) => sum + o.packagingFee, 0),
    ordersCount: dayOrders.length,
    dineInCount: dayOrders.filter(o => o.orderType === 'dine_in').length,
    takeawayCount: dayOrders.filter(o => o.orderType === 'takeaway').length,
    itemsSold: dayOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    orders: dayOrders
  };
}

// Helper para agrupar ventas por mes
function getMonthlySummaries(completedOrders: Order[]): MonthlySummary[] {
  const monthMap = new Map<string, { year: number; month: number; orders: Order[] }>();

  completedOrders.forEach(o => {
    const orderDate = new Date(o.createdAt);
    const year = orderDate.getFullYear();
    const month = orderDate.getMonth();
    const key = `${year}-${month}`;

    const existing = monthMap.get(key);
    if (existing) {
      existing.orders.push(o);
    } else {
      monthMap.set(key, { year, month, orders: [o] });
    }
  });

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const summaries: MonthlySummary[] = Array.from(monthMap.values()).map(({ year, month, orders }) => {
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const cashTotal = orders.reduce((sum, o) => {
      const cashPayments = o.payments.filter(p => p.paymentMethod === 'cash');
      return sum + cashPayments.reduce((s, p) => s + p.amount, 0);
    }, 0);
    const transferTotal = orders.reduce((sum, o) => {
      const transferPayments = o.payments.filter(p => p.paymentMethod === 'transfer');
      return sum + transferPayments.reduce((s, p) => s + p.amount, 0);
    }, 0);

    return {
      year,
      month,
      monthName: `${monthNames[month]} ${year}`,
      totalSales,
      cashTotal,
      transferTotal,
      packagingFeesTotal: orders.reduce((sum, o) => sum + o.packagingFee, 0),
      ordersCount: orders.length,
      dineInCount: orders.filter(o => o.orderType === 'dine_in').length,
      takeawayCount: orders.filter(o => o.orderType === 'takeaway').length,
      itemsSold: orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
    };
  });

  return summaries.sort((a, b) => b.year - a.year || b.month - a.month);
}

export function DashboardView({ orders, loading }: DashboardViewProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseType, setExpenseType] = useState<'expense' | 'loan_given' | 'loan_repaid'>('expense');
  const [savingExpense, setSavingExpense] = useState(false);

  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'completed');
  }, [orders]);

  const dailySummary = useMemo(() => {
    const summary = calculateDailySummaryForDate(completedOrders, selectedDate);
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayExpenses = expenses.filter(e => e.date === dateStr);
    
    let cashAdjustments = 0;
    dayExpenses.forEach(e => {
      if (e.type === 'loan_repaid') {
        cashAdjustments += e.amount;
      } else {
        cashAdjustments -= e.amount;
      }
    });

    return { ...summary, realCashTotal: summary.cashTotal + cashAdjustments };
  }, [completedOrders, selectedDate, expenses]);

  const monthlySummaries = useMemo(() => {
    return getMonthlySummaries(completedOrders);
  }, [completedOrders]);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const snap = await getDocs(collection(db, 'expenses'));
        const formattedExpenses: Expense[] = snap.docs.map(expenseDoc => {
          const data: any = expenseDoc.data();
          return {
            id: expenseDoc.id,
            description: data.description || '',
            amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0'),
            category: data.category || 'Otros',
            date: data.date || data.created_at || new Date().toISOString(),
            createdAt: data.created_at || data.date || new Date().toISOString(),
            type: data.type || 'expense'
          };
        });

        formattedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(formattedExpenses);
      } catch (error) {
        console.error('Error fetching expenses:', error);
      }
    };

    void fetchExpenses();
  }, []);

  const monthlyExpensesByKey = useMemo(() => {
    const expenseMap = new Map<string, Expense[]>();

    expenses.forEach(expense => {
      const expenseDateValue = new Date(`${expense.date}T00:00:00`);
      const key = `${expenseDateValue.getFullYear()}-${expenseDateValue.getMonth()}`;
      const current = expenseMap.get(key) || [];
      current.push(expense);
      expenseMap.set(key, current);
    });

    return expenseMap;
  }, [expenses]);

  const monthlyReports = useMemo(() => {
    const summaryMap = new Map(monthlySummaries.map(summary => [`${summary.year}-${summary.month}`, summary]));

    expenses.forEach(expense => {
      const expenseDateValue = new Date(`${expense.date}T00:00:00`);
      const key = `${expenseDateValue.getFullYear()}-${expenseDateValue.getMonth()}`;
      if (!summaryMap.has(key)) {
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const year = expenseDateValue.getFullYear();
        const month = expenseDateValue.getMonth();
        summaryMap.set(key, {
          year,
          month,
          monthName: `${monthNames[month]} ${year}`,
          totalSales: 0,
          cashTotal: 0,
          transferTotal: 0,
          packagingFeesTotal: 0,
          ordersCount: 0,
          dineInCount: 0,
          takeawayCount: 0,
          itemsSold: 0
        });
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.year - a.year || b.month - a.month);
  }, [expenses, monthlySummaries]);

  const resetExpenseForm = () => {
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseCategory(EXPENSE_CATEGORIES[0]);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseType('expense');
  };

  const handleSaveExpense = async () => {
    const amount = parseFloat(expenseAmount);
    const description = expenseDescription.trim();
    if (!description || isNaN(amount) || amount <= 0 || !expenseDate) return;

    setSavingExpense(true);
    try {
      const createdAt = new Date().toISOString();
      const finalCategory = expenseType === 'expense' ? expenseCategory : (expenseType === 'loan_given' ? 'Préstamo otorgado' : 'Préstamo cobrado');
      const expenseData = {
        description,
        amount,
        category: finalCategory,
        date: expenseDate,
        created_at: createdAt,
        type: expenseType
      };
      const expenseRef = await addDoc(collection(db, 'expenses'), expenseData);
      setExpenses(prev => [{
        id: expenseRef.id,
        description,
        amount,
        category: finalCategory,
        date: expenseDate,
        createdAt,
        type: expenseType
      }, ...prev]);
      resetExpenseForm();
      setShowExpenseForm(false);
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      setExpenses(prev => prev.filter(expense => expense.id !== expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white text-2xl font-bold">Caja y Reportes</h2>
          <p className="text-gray-500 text-xs">Administración financiera del negocio</p>
        </div>
      </div>

      {/* Selector de Vista */}
      <div className="flex p-1 bg-gray-800 rounded-xl mb-6">
        <button
          onClick={() => setViewMode('daily')}
          className={`flex-1 py-2 text-center rounded-lg font-semibold text-sm transition-all ${
            viewMode === 'daily'
              ? 'bg-gradient-to-r from-red-650 to-orange-500 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-250'
          }`}
        >
          Cierre Diario
        </button>
        <button
          onClick={() => setViewMode('monthly')}
          className={`flex-1 py-2 text-center rounded-lg font-semibold text-sm transition-all ${
            viewMode === 'monthly'
              ? 'bg-gradient-to-r from-red-650 to-orange-500 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-250'
          }`}
        >
          Resumen Mensual
        </button>
      </div>

      {/* Contenido según la pestaña */}
      {viewMode === 'daily' ? (
        <div>
          {/* Navegador de fecha */}
          <div className="flex items-center justify-between bg-gray-800 rounded-xl p-3 mb-5 border border-gray-700">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d);
              }}
              className="p-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(new Date(e.target.value + 'T00:00:00'));
                  }
                }}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-center text-sm"
              />
            </div>

            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                if (d <= new Date()) {
                  setSelectedDate(d);
                }
              }}
              disabled={(() => {
                const tomorrow = new Date(selectedDate);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0,0,0,0);
                const today = new Date();
                today.setHours(0,0,0,0);
                return tomorrow > today;
              })()}
              className="p-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <h3 className="text-white font-semibold">Resumen General</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatCard
                icon={<DollarSign className="w-5 h-5 text-white" />}
                label="Ventas Totales"
                value={`$${dailySummary.totalSales.toFixed(2)}`}
                color="from-red-600 to-orange-500"
                subtext={`${dailySummary.ordersCount} pedidos`}
              />
              <StatCard
                icon={<Receipt className="w-5 h-5 text-white" />}
                label="Cargos Envases"
                value={`$${dailySummary.packagingFeesTotal.toFixed(2)}`}
                color="from-orange-600 to-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Banknote className="w-5 h-5 text-white" />}
                label="Efectivo en Caja"
                value={`$${dailySummary.realCashTotal.toFixed(2)}`}
                color="from-green-600 to-emerald-500"
                subtext="ventas - gastos y préstamos"
              />
              <StatCard
                icon={<Smartphone className="w-5 h-5 text-white" />}
                label="Transferencias"
                value={`$${dailySummary.transferTotal.toFixed(2)}`}
                color="from-blue-600 to-cyan-500"
                subtext="en el banco"
              />
            </div>

            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-gray-800 rounded-xl p-3 flex items-center gap-3 border border-gray-700/30">
                <UtensilsCrossed className="w-7 h-7 text-amber-400" />
                <div>
                  <p className="text-gray-400 text-xs">En Local</p>
                  <p className="text-white font-bold text-base">{dailySummary.dineInCount}</p>
                </div>
              </div>
              <div className="flex-1 bg-gray-800 rounded-xl p-3 flex items-center gap-3 border border-gray-700/30">
                <Package className="w-7 h-7 text-orange-400" />
                <div>
                  <p className="text-gray-400 text-xs">Para Llevar</p>
                  <p className="text-white font-bold text-base">{dailySummary.takeawayCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 mt-3 flex items-center gap-3 border border-gray-700/30">
              <ShoppingCart className="w-7 h-7 text-green-400" />
              <div>
                <p className="text-gray-400 text-xs">Items Vendidos</p>
                <p className="text-white font-bold text-base">{dailySummary.itemsSold}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-orange-400" />
              <h3 className="text-white font-semibold">Pedidos de la Fecha</h3>
              <span className="ml-auto text-gray-500 text-sm">{dailySummary.orders.length} listados</span>
            </div>

            {dailySummary.orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-800/50 rounded-2xl border border-gray-800/80">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay pedidos completados en esta fecha</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dailySummary.orders.map(order => (
                  <div key={order.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {order.orderType === 'dine_in' ? (
                          <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-950/40 px-2 py-0.5 rounded-full">
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            Mesa {order.tableNumber}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-orange-400 text-xs font-bold bg-orange-950/40 px-2 py-0.5 rounded-full">
                            <Package className="w-3.5 h-3.5" />
                            Para Llevar
                          </span>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {order.items.map(item => (
                        <span key={item.id} className="text-gray-400 text-[10px] bg-gray-900/40 px-2 py-0.5 rounded border border-gray-700/30">
                          {item.quantity}x {item.productName}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                      <div className="flex gap-1.5">
                        {order.payments.map(p => (
                          <span
                            key={p.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold ${
                              p.paymentMethod === 'cash'
                                ? 'bg-green-950/50 text-green-400 border border-green-900/30'
                                : 'bg-blue-950/50 text-blue-400 border border-blue-900/30'
                            }`}
                          >
                            {p.paymentMethod === 'cash' ? (
                              <Banknote className="w-3 h-3" />
                            ) : (
                              <Smartphone className="w-3 h-3" />
                            )}
                            ${p.amount.toFixed(2)}
                          </span>
                        ))}
                      </div>
                      <span className="text-white font-bold text-sm">${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Vista Mensual */
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-white font-bold">Gastos del negocio</h3>
                <p className="text-gray-500 text-xs">Registra compras, servicios y pagos para ver la ganancia real</p>
              </div>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-bold text-sm"
              >
                <Plus className="w-4 h-4" />
                Gasto
              </button>
            </div>
          </div>

          {monthlyReports.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl border border-gray-700">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay datos mensuales registrados</p>
            </div>
          ) : (
            monthlyReports.map((monthSum) => {
              const monthExpenses = monthlyExpensesByKey.get(`${monthSum.year}-${monthSum.month}`) || [];
              let totalExpenses = 0;
              let cashAdjustments = 0;
              let loansGiven = 0;
              let loansRepaid = 0;

              monthExpenses.forEach(e => {
                if (e.type === 'loan_repaid') {
                  cashAdjustments += e.amount;
                  loansRepaid += e.amount;
                } else if (e.type === 'loan_given') {
                  cashAdjustments -= e.amount;
                  loansGiven += e.amount;
                } else {
                  totalExpenses += e.amount;
                  cashAdjustments -= e.amount;
                }
              });

              const netProfit = monthSum.totalSales - totalExpenses - loansGiven + loansRepaid;
              const realCashTotal = monthSum.cashTotal + cashAdjustments;

              return (
              <div key={monthSum.monthName} className="bg-gray-800 rounded-2xl p-5 border border-gray-700 shadow-md">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700/50 pb-2">
                  <h4 className="text-white text-lg font-bold tracking-wide">{monthSum.monthName}</h4>
                  <span className="text-xs text-orange-400 bg-orange-950/40 border border-orange-900/30 px-2.5 py-1 rounded-full font-bold">
                    {monthSum.ordersCount} pedidos
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Ventas Totales</span>
                    <span className="text-orange-400 font-extrabold text-xl">${monthSum.totalSales.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Ganancia Neta</span>
                    <span className={`font-extrabold text-xl ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${netProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/40">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-red-400" />
                      <span className="text-gray-400 text-xs font-semibold">Gastos</span>
                    </div>
                    <span className="text-red-400 font-bold text-lg">${totalExpenses.toFixed(2)}</span>
                  </div>
                  <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/40">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="w-4 h-4 text-amber-400" />
                      <span className="text-gray-400 text-xs font-semibold">Envases</span>
                    </div>
                    <span className="text-amber-500 font-bold text-lg">${monthSum.packagingFeesTotal.toFixed(2)}</span>
                  </div>
                </div>

                {(loansGiven > 0 || loansRepaid > 0) && (
                  <div className="bg-gray-900/50 rounded-xl p-3 mb-4 border border-gray-700/40 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400 text-xs font-semibold">Dinero Prestado (Pendiente del mes)</span>
                    </div>
                    <span className="text-purple-400 font-bold text-lg">${(loansGiven - loansRepaid).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700/30">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Banknote className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-gray-400 text-xs font-semibold">Efectivo Real</span>
                    </div>
                    <span className="text-white text-sm font-bold">${realCashTotal.toFixed(2)}</span>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-gray-400 text-xs font-semibold">Transferencia</span>
                    </div>
                    <span className="text-white text-sm font-bold">${monthSum.transferTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-700/30 text-center text-xs">
                  <div className="bg-gray-900/40 py-2 rounded-xl border border-gray-800">
                    <span className="text-gray-500 block text-[9px] font-bold">EN LOCAL</span>
                    <span className="text-amber-400 font-bold">{monthSum.dineInCount}</span>
                  </div>
                  <div className="bg-gray-900/40 py-2 rounded-xl border border-gray-800">
                    <span className="text-gray-500 block text-[9px] font-bold">LLEVAR</span>
                    <span className="text-orange-400 font-bold">{monthSum.takeawayCount}</span>
                  </div>
                  <div className="bg-gray-900/40 py-2 rounded-xl border border-gray-800">
                    <span className="text-gray-500 block text-[9px] font-bold">ITEMS VEND.</span>
                    <span className="text-green-400 font-bold">{monthSum.itemsSold}</span>
                  </div>
                </div>

                {monthExpenses.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-4 h-4 text-red-400" />
                      <span className="text-gray-300 text-sm font-semibold">Gastos registrados</span>
                    </div>
                    <div className="space-y-2">
                      {monthExpenses.map(expense => (
                        <div key={expense.id} className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-xl p-2 border border-gray-700/40">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{expense.description}</p>
                            <p className="text-gray-500 text-[10px]">
                              {expense.category} · {new Date(`${expense.date}T00:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 font-bold text-sm">${expense.amount.toFixed(2)}</span>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
            })
          )}
        </div>
      )}

      {showExpenseForm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white font-bold text-lg">Agregar gasto</h3>
              <button
                onClick={() => {
                  if (!savingExpense) {
                    resetExpenseForm();
                    setShowExpenseForm(false);
                  }
                }}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex bg-gray-700/50 p-1 rounded-xl">
                <button
                  onClick={() => setExpenseType('expense')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${expenseType === 'expense' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Gasto
                </button>
                <button
                  onClick={() => setExpenseType('loan_given')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${expenseType === 'loan_given' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Prestar
                </button>
                <button
                  onClick={() => setExpenseType('loan_repaid')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${expenseType === 'loan_repaid' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Cobrar
                </button>
              </div>

              <div>
                <label className="text-gray-300 text-sm font-semibold block mb-2">Detalle</label>
                <input
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="Ej. compra de carne"
                  className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 text-sm font-semibold block mb-2">Monto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-sm font-semibold block mb-2">Fecha</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {expenseType === 'expense' && (
                <div>
                  <label className="text-gray-300 text-sm font-semibold block mb-2">Categoría</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 rounded-xl border border-gray-600 focus:border-orange-500 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleSaveExpense}
                disabled={savingExpense}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-bold disabled:opacity-60"
              >
                {savingExpense ? 'Guardando...' : 'Guardar gasto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
