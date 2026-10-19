// =====================================================
// MODELS - Interfaces TypeScript para el POS
// =====================================================

export type Category = 'PLATOS FUERTES' | 'PORCIONES' | 'BEBIDAS' | 'EXTRAS' | 'COMBOS';
export type OrderType = 'dine_in' | 'takeaway';
export type PaymentMethod = 'cash' | 'transfer';
export type OrderStatus = 'active' | 'completed' | 'cancelled';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  requiresPackaging: boolean;
  stock: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  packagingSurcharge: number;
  itemTotal: number;
  isTakeaway: boolean;
  paid: boolean;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  receiptPhotoUrl?: string;
  itemIds: string[];
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderType: OrderType;
  tableNumber?: number;
  status: OrderStatus;
  subtotal: number;
  packagingFee: number;
  total: number;
  amountPaid: number;
  balance: number;
  createdAt: string;
  closedAt?: string;
  items: OrderItem[];
  payments: Payment[];
}

export interface DailySummary {
  totalSales: number;
  cashTotal: number;
  transferTotal: number;
  packagingFeesTotal: number;
  ordersCount: number;
  dineInCount: number;
  takeawayCount: number;
  itemsSold: number;
}

export interface ProductSales {
  productId: string;
  productName: string;
  category: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  packagingSurcharge: number;
  itemTotal: number;
  isTakeaway: boolean;
}

export interface Cart {
  items: CartItem[];
  orderType: OrderType;
  tableNumber?: number;
  subtotal: number;
  packagingFee: number;
  total: number;
}
