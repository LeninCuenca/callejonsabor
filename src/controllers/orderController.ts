// =====================================================
// CONTROLLERS - Pedidos y Pagos
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { db } from '../lib/firebase';
import { Order, OrderItem, Payment, OrderStatus, PaymentMethod } from '../models';
import { Product } from '../models';
import { PACKAGING_FEE } from './productController';
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

export function useOrderController() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (_status?: OrderStatus) => {
    setLoading(true);
    setError(null);

    try {
      const ordersQ = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
      const ordersSnap = await getDocs(ordersQ);

      const itemsSnap = await getDocs(collection(db, 'order_items'));
      const paymentsSnap = await getDocs(collection(db, 'payments'));

      const itemsData = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const paymentsData = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const formattedOrders: Order[] = ordersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .map((order: any) => ({
          id: order.id,
          orderType: order.order_type,
          tableNumber: order.table_number,
          status: order.status,
          subtotal: typeof order.subtotal === 'number' ? order.subtotal : parseFloat(order.subtotal || '0'),
          packagingFee: typeof order.packaging_fee === 'number' ? order.packaging_fee : parseFloat(order.packaging_fee || '0'),
          total: typeof order.total === 'number' ? order.total : parseFloat(order.total || '0'),
          amountPaid: typeof order.amount_paid === 'number' ? order.amount_paid : parseFloat(order.amount_paid || '0'),
          balance: typeof order.balance === 'number' ? order.balance : parseFloat(order.balance || '0'),
          createdAt: order.created_at,
          closedAt: order.closed_at,
          items: (itemsData || [])
            .filter((item: any) => item.order_id === order.id)
            .map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              productName: item.product_name,
              category: item.category,
              quantity: item.quantity,
              unitPrice: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(item.unit_price || '0'),
              packagingSurcharge: typeof item.packaging_surcharge === 'number' ? item.packaging_surcharge : parseFloat(item.packaging_surcharge || '0'),
              itemTotal: typeof item.item_total === 'number' ? item.item_total : parseFloat(item.item_total || '0'),
              isTakeaway: item.is_takeaway,
              paid: item.paid
            })),
          payments: (paymentsData || [])
            .filter((p: any) => p.order_id === order.id)
            .map((p: any) => ({
              id: p.id,
              orderId: p.order_id,
              amount: typeof p.amount === 'number' ? p.amount : parseFloat(p.amount || '0'),
              paymentMethod: p.payment_method,
              receiptPhotoUrl: p.receipt_photo_url,
              itemIds: p.item_ids || [],
              notes: p.notes,
              createdAt: p.created_at
            }))
        }));

      setOrders(formattedOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(async (
    items: { product: Product; quantity: number; isTakeaway: boolean }[],
    orderType: 'dine_in' | 'takeaway',
    tableNumber?: number
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      let subtotal = 0;
      let packagingFee = 0;
      const orderItems: Array<{
        product_id: string;
        product_name: string;
        category: string;
        quantity: number;
        unit_price: number;
        packaging_surcharge: number;
        item_total: number;
        is_takeaway: boolean;
        paid: boolean;
      }> = [];

      for (const item of items) {
        const basePrice = item.product.price * item.quantity;
        let itemPackaging = 0;

        if (item.isTakeaway && item.product.requiresPackaging) {
          itemPackaging = PACKAGING_FEE * item.quantity;
        }

        const itemTotal = basePrice + itemPackaging;

        subtotal += basePrice;
        packagingFee += itemPackaging;

        orderItems.push({
          product_id: item.product.id,
          product_name: item.product.name,
          category: item.product.category,
          quantity: item.quantity,
          unit_price: item.product.price,
          packaging_surcharge: itemPackaging,
          item_total: itemTotal,
          is_takeaway: item.isTakeaway,
          paid: false
        });
      }

      const total = subtotal + packagingFee;
      const createdAt = new Date().toISOString();
      const batch = writeBatch(db);
      const orderRef = doc(collection(db, 'orders'));
      const remainingStockByProduct = new Map<string, number>();
      const productById = new Map<string, Product>();

      for (const item of items) {
        const currentStock = remainingStockByProduct.get(item.product.id) ?? item.product.stock;
        remainingStockByProduct.set(item.product.id, Math.max(0, currentStock - item.quantity));
        productById.set(item.product.id, item.product);
      }

      batch.set(orderRef, {
        order_type: orderType,
        table_number: tableNumber || null,
        status: 'active',
        subtotal,
        packaging_fee: packagingFee,
        total,
        amount_paid: 0,
        balance: total,
        created_at: createdAt
      });

      const itemsWithIds = orderItems.map((item) => {
        const itemRef = doc(collection(db, 'order_items'));
        batch.set(itemRef, { ...item, order_id: orderRef.id });

        return {
          id: itemRef.id,
          productId: item.product_id,
          productName: item.product_name,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          packagingSurcharge: item.packaging_surcharge,
          itemTotal: item.item_total,
          isTakeaway: item.is_takeaway,
          paid: item.paid
        };
      });

      for (const [productId, remainingStock] of remainingStockByProduct.entries()) {
        const product = productById.get(productId);
        if (!product) continue;
        batch.update(doc(db, 'products', product.id), { stock: remainingStock });
      }

      const newOrder: Order = {
        id: orderRef.id,
        orderType,
        tableNumber: tableNumber || undefined,
        status: 'active',
        subtotal,
        packagingFee,
        total,
        amountPaid: 0,
        balance: total,
        createdAt,
        items: itemsWithIds,
        payments: []
      };

      await batch.commit();
      setOrders(prev => [newOrder, ...prev]);

      return newOrder;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error creating order';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addItemsToOrder = useCallback(async (
    orderId: string,
    newItems: { product: Product; quantity: number; isTakeaway: boolean }[]
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      let additionalSubtotal = 0;
      let additionalPackaging = 0;
      const orderItems: any[] = [];

      for (const item of newItems) {
        const basePrice = item.product.price * item.quantity;
        let itemPackaging = 0;

        if (item.isTakeaway && item.product.requiresPackaging) {
          itemPackaging = PACKAGING_FEE * item.quantity;
        }

        const itemTotal = basePrice + itemPackaging;

        additionalSubtotal += basePrice;
        additionalPackaging += itemPackaging;

        orderItems.push({
          order_id: orderId,
          product_id: item.product.id,
          product_name: item.product.name,
          category: item.product.category,
          quantity: item.quantity,
          unit_price: item.product.price,
          packaging_surcharge: itemPackaging,
          item_total: itemTotal,
          is_takeaway: item.isTakeaway,
          paid: false
        });

        // update product stock
        try {
          const prodRef = doc(db, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          const currentStock = prodSnap.exists() ? (prodSnap.data() as any).stock || 0 : item.product.stock;
          const newStock = Math.max(0, currentStock - item.quantity);
          await updateDoc(prodRef, { stock: newStock });
        } catch (e) {
          console.error('Error updating stock for addItemsToOrder', e);
        }
      }

      // insert new order items and retrieve their document IDs
      const addedItemsWithIds = await Promise.all(
        orderItems.map(async (item) => {
          const itemDoc = await addDoc(collection(db, 'order_items'), item);
          return {
            id: itemDoc.id,
            productId: item.product_id,
            productName: item.product_name,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            packagingSurcharge: item.packaging_surcharge,
            itemTotal: item.item_total,
            isTakeaway: item.is_takeaway,
            paid: item.paid
          };
        })
      );

      const newSubtotal = order.subtotal + additionalSubtotal;
      const newPackaging = order.packagingFee + additionalPackaging;
      const newTotal = newSubtotal + newPackaging;
      const newBalance = newTotal - order.amountPaid;

      await updateDoc(doc(db, 'orders', orderId), {
        subtotal: newSubtotal,
        packaging_fee: newPackaging,
        total: newTotal,
        balance: newBalance
      });

      await fetchOrders();

      const updatedOrder: Order = {
        ...order,
        subtotal: newSubtotal,
        packagingFee: newPackaging,
        total: newTotal,
        balance: newBalance,
        items: [...order.items, ...addedItemsWithIds]
      };

      return updatedOrder;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding items');
      return null;
    } finally {
      setLoading(false);
    }
  }, [orders, fetchOrders]);
  const processPayment = useCallback(async (
    orderId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    itemIds: string[],
    receiptPhotoUrl?: string,
    itemPayments?: { id: string; qty: number }[],
    splitPayments?: { amount: number; method: PaymentMethod; receiptPhotoUrl?: string }[]
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      // Record payment(s)
      const createdAt = new Date().toISOString();
      if (splitPayments && splitPayments.length > 0) {
        // Mixed payment: record each split as a separate payment doc
        await Promise.all(splitPayments.map(sp =>
          addDoc(collection(db, 'payments'), {
            order_id: orderId,
            amount: sp.amount,
            payment_method: sp.method,
            receipt_photo_url: sp.receiptPhotoUrl || null,
            item_ids: itemIds,
            created_at: createdAt
          })
        ));
      } else {
        await addDoc(collection(db, 'payments'), {
          order_id: orderId,
          amount,
          payment_method: paymentMethod,
          receipt_photo_url: receiptPhotoUrl || null,
          item_ids: itemIds,
          created_at: createdAt
        });
      }

      // Mark items as paid (with partial payment support)
      const paidItemIds: string[] = [];
      const updatedItemsMap = new Map<string, OrderItem>();

      if (itemPayments && itemPayments.length > 0) {
        // Partial payment mode: itemPayments contains {id, qty} for each selected item
        await Promise.all(itemPayments.map(async ({ id, qty }) => {
          const orderItem = order.items.find(i => i.id === id);
          if (!orderItem) return;

          if (qty >= orderItem.quantity) {
            // Full item paid
            await updateDoc(doc(db, 'order_items', id), { paid: true });
            paidItemIds.push(id);
            updatedItemsMap.set(id, { ...orderItem, paid: true });
          } else {
            // Partial payment: split the item
            const paidUnitPrice = orderItem.unitPrice;
            const paidPackaging = orderItem.quantity > 0 ? (orderItem.packagingSurcharge / orderItem.quantity) * qty : 0;
            const paidItemTotal = paidUnitPrice * qty + paidPackaging;

            const remainingQty = orderItem.quantity - qty;
            const remainingPackaging = orderItem.packagingSurcharge - paidPackaging;
            const remainingTotal = orderItem.unitPrice * remainingQty + remainingPackaging;

            // Update the original item to reflect remaining quantity
            await updateDoc(doc(db, 'order_items', id), {
              quantity: remainingQty,
              packaging_surcharge: remainingPackaging,
              item_total: remainingTotal
            });

            // Create a new item for the paid portion
            const paidItemDoc = await addDoc(collection(db, 'order_items'), {
              order_id: orderId,
              product_id: orderItem.productId,
              product_name: orderItem.productName,
              category: orderItem.category,
              quantity: qty,
              unit_price: paidUnitPrice,
              packaging_surcharge: paidPackaging,
              item_total: paidItemTotal,
              is_takeaway: orderItem.isTakeaway,
              paid: true
            });

            paidItemIds.push(paidItemDoc.id);

            // Update local state map for the split items
            updatedItemsMap.set(id, {
              ...orderItem,
              quantity: remainingQty,
              packagingSurcharge: remainingPackaging,
              itemTotal: remainingTotal
            });
          }
        }));
      } else if (itemIds.length > 0) {
        // Legacy full-item payment mode
        await Promise.all(itemIds.map(id => updateDoc(doc(db, 'order_items', id), { paid: true })));
        paidItemIds.push(...itemIds);
      }

      const newAmountPaid = order.amountPaid + amount;
      const newBalance = Math.max(0, order.total - newAmountPaid);
      const isCompleted = newBalance <= 0;

      const updateData: any = {
        amount_paid: newAmountPaid,
        balance: newBalance
      };

      if (isCompleted) {
        updateData.status = 'completed';
        updateData.closed_at = new Date().toISOString();
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);

      // Trigger state refresh
      await fetchOrders();

      // Return the updated order object
      const newPayments: Payment[] = splitPayments && splitPayments.length > 0
        ? splitPayments.map((sp, i) => ({
            id: `temp-${Date.now()}-${i}`,
            orderId,
            amount: sp.amount,
            paymentMethod: sp.method,
            receiptPhotoUrl: sp.receiptPhotoUrl || undefined,
            itemIds: paidItemIds,
            createdAt
          }))
        : [{
            id: `temp-${Date.now()}`,
            orderId,
            amount,
            paymentMethod,
            receiptPhotoUrl: receiptPhotoUrl || undefined,
            itemIds: paidItemIds,
            createdAt
          }];

      const updatedOrder: Order = {
        ...order,
        amountPaid: newAmountPaid,
        balance: newBalance,
        status: isCompleted ? 'completed' : order.status,
        closedAt: isCompleted ? updateData.closed_at : order.closedAt,
        items: order.items.map(item => {
          const mapped = updatedItemsMap.get(item.id);
          if (mapped) return mapped;
          if (paidItemIds.includes(item.id)) return { ...item, paid: true };
          return item;
        }),
        payments: [...order.payments, ...newPayments]
      };



      return updatedOrder;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing payment');
      return null;
    } finally {
      setLoading(false);
    }
  }, [orders, fetchOrders]);

  const removeItemFromOrder = useCallback(async (
    orderId: string,
    itemId: string
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      const item = order.items.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');
      if (item.paid) throw new Error('No se puede eliminar un ítem ya pagado');

      // Restaurar stock del producto
      try {
        const prodRef = doc(db, 'products', item.productId);
        const prodSnap = await getDoc(prodRef);
        const currentStock = prodSnap.exists() ? (prodSnap.data() as any).stock || 0 : 0;
        await updateDoc(prodRef, { stock: currentStock + item.quantity });
      } catch (e) {
        console.error('Error restoring stock for removeItemFromOrder', e);
      }

      // Eliminar el ítem de Firestore
      await deleteDoc(doc(db, 'order_items', itemId));

      // Recalcular totales del pedido
      const remainingItems = order.items.filter(i => i.id !== itemId);
      const newSubtotal = remainingItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const newPackaging = remainingItems.reduce((sum, i) => sum + i.packagingSurcharge, 0);
      const newTotal = newSubtotal + newPackaging;
      const newBalance = Math.max(0, newTotal - order.amountPaid);

      await updateDoc(doc(db, 'orders', orderId), {
        subtotal: newSubtotal,
        packaging_fee: newPackaging,
        total: newTotal,
        balance: newBalance
      });

      await fetchOrders();

      const updatedOrder: Order = {
        ...order,
        subtotal: newSubtotal,
        packagingFee: newPackaging,
        total: newTotal,
        balance: newBalance,
        items: remainingItems
      };

      return updatedOrder;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing item');
      return null;
    } finally {
      setLoading(false);
    }
  }, [orders, fetchOrders]);

  const finalizeOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'completed',
        closed_at: new Date().toISOString()
      });

      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error finalizing order');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        // Restaurar stock
        for (const item of order.items) {
          try {
            const prodRef = doc(db, 'products', item.productId);
            const prodSnap = await getDoc(prodRef);
            const currentStock = prodSnap.exists() ? (prodSnap.data() as any).stock || 0 : 0;
            await updateDoc(prodRef, { stock: currentStock + item.quantity });
          } catch (e) {
            console.error('Error restoring stock for deleteOrder', e);
          }
        }
      }

      // delete payments
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('order_id', '==', orderId)));
      await Promise.all(paymentsSnap.docs.map(d => deleteDoc(doc(db, 'payments', d.id))));

      // delete order_items
      const itemsSnap = await getDocs(query(collection(db, 'order_items'), where('order_id', '==', orderId)));
      await Promise.all(itemsSnap.docs.map(d => deleteDoc(doc(db, 'order_items', d.id))));

      // delete order
      await deleteDoc(doc(db, 'orders', orderId));

      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting order');
      return false;
    } finally {
      setLoading(false);
    }
  }, [orders, fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Corregir el método de pago de un pago ya registrado (solo efectivo ↔ transferencia)
  const correctPaymentMethod = useCallback(async (
    paymentId: string,
    newMethod: PaymentMethod,
    receiptPhotoUrl?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const updateData: any = { payment_method: newMethod };
      if (receiptPhotoUrl !== undefined) {
        updateData.receipt_photo_url = receiptPhotoUrl || null;
      }
      await updateDoc(doc(db, 'payments', paymentId), updateData);
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error corrigiendo método de pago');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    fetchOrders,
    createOrder,
    addItemsToOrder,
    removeItemFromOrder,
    processPayment,
    correctPaymentMethod,
    finalizeOrder,
    deleteOrder
  };
}
