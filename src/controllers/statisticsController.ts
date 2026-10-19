// =====================================================
// CONTROLLERS - Estadisticas y Reportes
// =====================================================

import { useCallback, useMemo } from 'react';
import { Order, DailySummary, ProductSales } from '../models';

export function useStatisticsController(orders: Order[]) {
  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'completed');
  }, [orders]);

  const calculateDailySummary = useCallback((date?: Date): DailySummary => {
    const filterDate = date || new Date();
    const startOfDay = new Date(filterDate);
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
      itemsSold: dayOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
    };
  }, [completedOrders]);

  const getTopSellingProducts = useCallback((limit: number = 5): ProductSales[] => {
    const productMap = new Map<string, ProductSales>();

    completedOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.totalRevenue += item.itemTotal;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            category: item.category,
            quantitySold: item.quantity,
            totalRevenue: item.itemTotal
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit);
  }, [completedOrders]);

  const getLeastSellingProducts = useCallback((limit: number = 5): ProductSales[] => {
    const productMap = new Map<string, ProductSales>();

    completedOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.totalRevenue += item.itemTotal;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            category: item.category,
            quantitySold: item.quantity,
            totalRevenue: item.itemTotal
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => a.quantitySold - b.quantitySold)
      .slice(0, limit);
  }, [completedOrders]);

  const getOrdersByDateRange = useCallback((startDate: Date, endDate: Date): Order[] => {
    return completedOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [completedOrders]);

  return {
    calculateDailySummary,
    getTopSellingProducts,
    getLeastSellingProducts,
    getOrdersByDateRange
  };
}
