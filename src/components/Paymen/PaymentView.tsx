// =====================================================
// VIEWS - Components - Procesamiento de Pagos
// =====================================================

import { useState, useMemo, useRef, useCallback } from 'react';
import { Order, PaymentMethod } from '../../models';
import { X, Banknote, Smartphone, Camera, Check, AlertCircle, CreditCard, ShoppingBag, Loader2, Trash2, Plus, Minus } from 'lucide-react';
import { uploadReceiptPhoto } from '../../lib/receiptStorage';
import { captureReceiptImage, isNativeApp, isUserCancelled } from '../../lib/receiptCapture';

interface PaymentViewProps {
  order: Order;
  onProcessPayment: (
    amount: number,
    method: PaymentMethod,
    itemIds: string[],
    receiptPhoto?: string,
    itemPayments?: { id: string; qty: number }[],
    splitPayments?: { amount: number; method: PaymentMethod; receiptPhotoUrl?: string }[]
  ) => Promise<boolean>;
  onAddItems: () => void;
  onRemoveItem: (itemId: string) => Promise<boolean>;
  onFinalize: () => Promise<boolean>;
  onCorrectPayment: (paymentId: string, newMethod: PaymentMethod, receiptPhotoUrl?: string) => Promise<boolean>;
  onClose: () => void;
  loading: boolean;
}

type PaymentMode = 'choose' | 'amount' | 'items';
type AmountPaymentKind = 'mixed' | 'cash' | 'transfer';

export function PaymentView({
  order,
  onProcessPayment,
  onAddItems,
  onRemoveItem,
  onFinalize,
  onCorrectPayment,
  onClose,
  loading
}: PaymentViewProps) {
  const [mode, setMode] = useState<PaymentMode>('choose');
  const [amountPaymentKind, setAmountPaymentKind] = useState<AmountPaymentKind>('cash');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  // --- Pago por monto: efectivo, transferencia o variado ---
  const [cashAmount, setCashAmount] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  // selectedQuantities: Map<itemId, qtyToPay> — allows partial payment per item
  const [selectedQuantities, setSelectedQuantities] = useState<Map<string, number>>(new Map());
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>();
  const [receiptPreview, setReceiptPreview] = useState<string | undefined>();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // --- Correción de método de pago ---
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [correctionReceiptPhoto, setCorrectionReceiptPhoto] = useState<string | undefined>();
  const [correctionReceiptPreview, setCorrectionReceiptPreview] = useState<string | undefined>();
  const [correctionUploading, setCorrectionUploading] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const correctionCameraRef = useRef<HTMLInputElement>(null);
  const correctionGalleryRef = useRef<HTMLInputElement>(null);

  const unpaidItems = useMemo(() => order.items.filter(i => !i.paid), [order.items]);

  // Calculate total based on partial quantities selected
  const selectedItemTotal = useMemo(() => {
    let total = 0;
    for (const item of unpaidItems) {
      const qty = selectedQuantities.get(item.id) ?? 0;
      if (qty > 0) {
        // Calculate unit cost (unitPrice + packaging per unit)
        const unitCost = item.unitPrice + (item.packagingSurcharge / item.quantity);
        total += unitCost * qty;
      }
    }
    return total;
  }, [unpaidItems, selectedQuantities]);

  // IDs of items that have at least 1 unit selected
  const selectedItemIds = useMemo(() => {
    return Array.from(selectedQuantities.entries())
      .filter(([, qty]) => qty > 0)
      .map(([id]) => id);
  }, [selectedQuantities]);

  const handleSetQuantity = useCallback((itemId: string, delta: number, maxQty: number) => {
    setSelectedQuantities(prev => {
      const next = new Map(prev);
      const current = next.get(itemId) ?? 0;
      const newQty = Math.min(maxQty, Math.max(0, current + delta));
      if (newQty === 0) {
        next.delete(itemId);
      } else {
        next.set(itemId, newQty);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    const allSelected = unpaidItems.every(i => (selectedQuantities.get(i.id) ?? 0) === i.quantity);
    if (allSelected) {
      setSelectedQuantities(new Map());
    } else {
      const next = new Map<string, number>();
      unpaidItems.forEach(i => next.set(i.id, i.quantity));
      setSelectedQuantities(next);
    }
  };

  const handleSetAmountPaymentKind = (kind: AmountPaymentKind) => {
    setAmountPaymentKind(kind);
    setReceiptPhoto(undefined);
    setReceiptPreview(undefined);
    setPhotoError(null);

    if (kind === 'cash') {
      setCashAmount(order.balance.toFixed(2));
      setTransferAmount('');
      return;
    }

    if (kind === 'transfer') {
      setCashAmount('');
      setTransferAmount(order.balance.toFixed(2));
      return;
    }

    setCashAmount('');
    setTransferAmount('');
  };

  const handlePayment = async () => {
    let paymentAmount = 0;
    let itemIds: string[] = [];

    if (mode === 'amount') {
      // Mixed payment mode: cash + transfer
      const cashParsed = parseFloat(cashAmount) || 0;
      const transferParsed = parseFloat(transferAmount) || 0;
      // Actual amount to charge (capped at balance for the whole transaction)
      const effectiveCash = Math.min(cashParsed, order.balance);
      const effectiveTransfer = Math.min(transferParsed, Math.max(0, order.balance - effectiveCash));
      paymentAmount = effectiveCash + effectiveTransfer;
      if (paymentAmount <= 0) return;

      const splitPayments: { amount: number; method: PaymentMethod; receiptPhotoUrl?: string }[] = [];
      if (effectiveCash > 0)    splitPayments.push({ amount: effectiveCash, method: 'cash' });
      if (effectiveTransfer > 0) splitPayments.push({ amount: effectiveTransfer, method: 'transfer', receiptPhotoUrl: receiptPhoto });

      const success = await onProcessPayment(
        paymentAmount,
        'cash',      // fallback method (not used when splitPayments provided)
        [],
        receiptPhoto,
        undefined,
        splitPayments.length > 1 || (splitPayments.length === 1 && splitPayments[0].method === 'transfer')
          ? splitPayments
          : undefined
      );

      if (success) {
        setCashAmount('');
        setTransferAmount('');
        setReceiptPhoto(undefined);
        setReceiptPreview(undefined);
        setPhotoError(null);
        setMode('choose');
      }
      return;
    }

    if (mode === 'items') {
      paymentAmount = selectedItemTotal;
      itemIds = selectedItemIds;
    }

    if (paymentAmount <= 0) return;

    // Build itemPayments for partial quantity support
    const itemPayments: { id: string; qty: number }[] = mode === 'items'
      ? Array.from(selectedQuantities.entries())
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => ({ id, qty }))
      : [];

    const success = await onProcessPayment(
      paymentAmount,
      paymentMethod,
      itemIds,
      receiptPhoto,
      itemPayments.length > 0 ? itemPayments : undefined
    );

    if (success) {
      setCashAmount('');
      setTransferAmount('');
      setSelectedQuantities(new Map());
      setReceiptPhoto(undefined);
      setReceiptPreview(undefined);
      setPhotoError(null);
      setMode('choose');
    }
  };

  const isBalanceZero = order.balance <= 0;

  // Amount payment computed values
  const cashParsed = parseFloat(cashAmount) || 0;
  const transferParsed = parseFloat(transferAmount) || 0;
  const totalEntered = cashParsed + transferParsed;
  const effectiveCash = Math.min(cashParsed, order.balance);
  const effectiveTransfer = Math.min(transferParsed, Math.max(0, order.balance - effectiveCash));
  const amountToCharge = effectiveCash + effectiveTransfer;
  const cashChange = Math.max(cashParsed - (order.balance - Math.min(transferParsed, order.balance)), 0);
  const hasCashChange = cashParsed > 0 && totalEntered > order.balance;
  const transferNeedsReceipt = transferParsed > 0 && !receiptPhoto;
  const itemTransferNeedsReceipt = paymentMethod === 'transfer' && !receiptPhoto;
  const canProcessAmount =
    amountToCharge > 0 &&
    !transferNeedsReceipt &&
    !uploadingPhoto;
  const canProcessItems =
    selectedItemIds.length > 0 &&
    selectedItemTotal > 0 &&
    !itemTransferNeedsReceipt &&
    !uploadingPhoto;

  const handlePhotoFile = async (file: File) => {
    setPhotoError(null);
    setUploadingPhoto(true);

    const previewUrl = URL.createObjectURL(file);
    setReceiptPreview(previewUrl);

    try {
      const downloadUrl = await uploadReceiptPhoto(order.id, file);
      setReceiptPhoto(downloadUrl);
      setShowPhotoModal(false);
    } catch {
      setPhotoError('No se pudo subir el comprobante. Intenta de nuevo.');
      setReceiptPhoto(undefined);
      setReceiptPreview(undefined);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleNativeCapture = async (source: 'camera' | 'gallery') => {
    setPhotoError(null);
    setUploadingPhoto(true);

    try {
      const { blob, preview } = await captureReceiptImage(source);
      setReceiptPreview(preview);

      const downloadUrl = await uploadReceiptPhoto(order.id, blob);
      setReceiptPhoto(downloadUrl);
      setShowPhotoModal(false);
    } catch (error) {
      if (isUserCancelled(error)) return;

      setPhotoError(
        source === 'camera'
          ? 'No se pudo tomar la foto. Verifica los permisos de camara.'
          : 'No se pudo abrir la galeria. Verifica los permisos de fotos.'
      );
      setReceiptPhoto(undefined);
      setReceiptPreview(undefined);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakePhoto = () => {
    if (isNativeApp()) {
      void handleNativeCapture('camera');
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handlePickGallery = () => {
    if (isNativeApp()) {
      void handleNativeCapture('gallery');
    } else {
      galleryInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      await handlePhotoFile(file);
    }
  };

  const handleClearReceipt = () => {
    setReceiptPhoto(undefined);
    setReceiptPreview(undefined);
    setPhotoError(null);
  };

  // --- Handlers de corrección de método de pago ---
  const handleCorrectionPhotoFile = async (file: File) => {
    setCorrectionError(null);
    setCorrectionUploading(true);
    const preview = URL.createObjectURL(file);
    setCorrectionReceiptPreview(preview);
    try {
      const url = await uploadReceiptPhoto(order.id, file);
      setCorrectionReceiptPhoto(url);
    } catch {
      setCorrectionError('No se pudo subir el comprobante.');
      setCorrectionReceiptPhoto(undefined);
      setCorrectionReceiptPreview(undefined);
    } finally {
      setCorrectionUploading(false);
    }
  };

  const handleCorrectionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await handleCorrectionPhotoFile(file);
  };

  const handleApplyCorrection = async (paymentId: string, newMethod: PaymentMethod) => {
    if (newMethod === 'transfer' && !correctionReceiptPhoto) return;
    const ok = await onCorrectPayment(paymentId, newMethod, correctionReceiptPhoto);
    if (ok) {
      setEditingPaymentId(null);
      setCorrectionReceiptPhoto(undefined);
      setCorrectionReceiptPreview(undefined);
      setCorrectionError(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <header className="bg-gradient-to-r from-red-700 to-orange-600 px-4 pb-3 flex items-center justify-between flex-shrink-0 safe-area-pt">
        <div>
          <h2 className="text-white font-bold">Cobrar Pedido</h2>
          <p className="text-white/70 text-sm">
            {order.orderType === 'dine_in' ? `Mesa ${order.tableNumber}` : 'Para Llevar'}
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Total del Pedido:</span>
            <span className="text-white text-xl font-bold">${order.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Total Pagado:</span>
            <span className="text-green-400 font-bold">${order.amountPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-700">
            <span className="text-gray-400">Saldo Pendiente:</span>
            <span className={`text-2xl font-bold ${order.balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
              ${order.balance.toFixed(2)}
            </span>
          </div>
        </div>

        {order.payments.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <h4 className="text-white font-semibold mb-3">Pagos Realizados</h4>
            <div className="space-y-2">
              {order.payments.map(payment => (
                <div key={payment.id}>
                  {/* Fila del pago */}
                  <div className="flex justify-between items-center text-sm py-1">
                    <div className="flex items-center gap-2">
                      {payment.paymentMethod === 'cash' ? (
                        <Banknote className="w-4 h-4 text-green-400" />
                      ) : (
                        <Smartphone className="w-4 h-4 text-blue-400" />
                      )}
                      <span className="text-gray-400">
                        {payment.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">${payment.amount.toFixed(2)}</span>
                      {/* Botón editar método */}
                      <button
                        onClick={() => {
                          if (editingPaymentId === payment.id) {
                            setEditingPaymentId(null);
                            setCorrectionReceiptPhoto(undefined);
                            setCorrectionReceiptPreview(undefined);
                            setCorrectionError(null);
                          } else {
                            setEditingPaymentId(payment.id);
                            setCorrectionReceiptPhoto(undefined);
                            setCorrectionReceiptPreview(undefined);
                            setCorrectionError(null);
                          }
                        }}
                        title="Corregir método de pago"
                        className={`p-1 rounded-lg transition-colors ${
                          editingPaymentId === payment.id
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'text-gray-500 hover:text-orange-400 hover:bg-orange-500/10'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Panel de corrección inline */}
                  {editingPaymentId === payment.id && (
                    <div className="mt-2 ml-1 p-3 bg-gray-700/60 border border-orange-500/30 rounded-xl space-y-3">
                      <p className="text-orange-300 text-xs font-semibold">Corregir método de pago</p>

                      {/* Selector de método */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApplyCorrection(payment.id, 'cash')}
                          disabled={loading || payment.paymentMethod === 'cash'}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                            payment.paymentMethod === 'cash'
                              ? 'bg-green-600/30 text-green-400 border border-green-600/40 cursor-default'
                              : 'bg-gray-600 hover:bg-green-700 text-gray-300 hover:text-white'
                          }`}
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          {payment.paymentMethod === 'cash' ? 'Actual: Efectivo' : 'Cambiar a Efectivo'}
                        </button>
                        <button
                          onClick={() => {
                            // Para transferencia, necesitamos el comprobante primero si no lo tiene
                            if (!correctionReceiptPhoto) {
                              correctionCameraRef.current?.click();
                            } else {
                              void handleApplyCorrection(payment.id, 'transfer');
                            }
                          }}
                          disabled={loading || payment.paymentMethod === 'transfer'}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                            payment.paymentMethod === 'transfer'
                              ? 'bg-blue-600/30 text-blue-400 border border-blue-600/40 cursor-default'
                              : 'bg-gray-600 hover:bg-blue-700 text-gray-300 hover:text-white'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          {payment.paymentMethod === 'transfer' ? 'Actual: Transferencia' : 'Cambiar a Transfer'}
                        </button>
                      </div>

                      {/* Subida de comprobante para transferencia */}
                      {payment.paymentMethod === 'cash' && (
                        <div className="space-y-2">
                          <p className="text-gray-400 text-xs">Para cambiar a transferencia, adjunta el comprobante:</p>
                          {correctionUploading ? (
                            <div className="flex items-center gap-2 text-gray-400 text-xs p-2 bg-gray-600 rounded-lg">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Subiendo...
                            </div>
                          ) : correctionReceiptPhoto ? (
                            <div className="space-y-2">
                              {correctionReceiptPreview && (
                                <img src={correctionReceiptPreview} alt="Comprobante" className="w-full max-h-32 object-contain rounded-lg bg-black/30" />
                              )}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-1.5 bg-green-950/50 border border-green-700 rounded-lg p-2 text-xs">
                                  <Check className="w-3.5 h-3.5 text-green-400" />
                                  <span className="text-green-300">Comprobante listo</span>
                                </div>
                                <button
                                  onClick={() => void handleApplyCorrection(payment.id, 'transfer')}
                                  disabled={loading}
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {loading ? '...' : 'Guardar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => correctionCameraRef.current?.click()}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs rounded-lg transition-colors"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              Adjuntar Comprobante
                            </button>
                          )}
                          {correctionError && (
                            <p className="text-red-400 text-xs flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />{correctionError}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Inputs ocultos para subir foto de correción */}
                      <input ref={correctionCameraRef} type="file" accept="image/*" className="hidden" onChange={handleCorrectionFileChange} />
                      <input ref={correctionGalleryRef} type="file" accept="image/*" className="hidden" onChange={handleCorrectionFileChange} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'choose' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-3">Modo de Cobro</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setMode('amount');
                    handleSetAmountPaymentKind('cash');
                  }}
                  className="p-4 bg-gray-700 rounded-xl text-center hover:bg-gray-600 transition-colors"
                >
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                  <span className="text-white font-medium">Por Monto</span>
                  <p className="text-gray-400 text-xs mt-1">Abonar cantidad libre</p>
                </button>

                <button
                  onClick={() => setMode('items')}
                  className="p-4 bg-gray-700 rounded-xl text-center hover:bg-gray-600 transition-colors"
                >
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                  <span className="text-white font-medium">Por Items</span>
                  <p className="text-gray-400 text-xs mt-1">Cobrar productos especificos</p>
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-3">Detalle de Items</h4>
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm py-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-white truncate ${item.paid ? 'line-through text-gray-500' : ''}`}>
                        {item.productName}
                      </span>
                      <span className="text-gray-500 flex-shrink-0">x{item.quantity}</span>
                      {item.paid && (
                        <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                          Pagado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-semibold ${item.paid ? 'text-gray-500' : 'text-gray-300'}`}>
                        ${item.itemTotal.toFixed(2)}
                      </span>
                      {!item.paid && (
                        confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                await onRemoveItem(item.id);
                                setConfirmDeleteId(null);
                              }}
                              disabled={loading}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg font-bold transition-colors disabled:opacity-50"
                            >
                              Sí, borrar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs rounded-lg transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition-colors"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onAddItems}
              className="w-full p-4 bg-gray-800 rounded-xl flex items-center justify-center gap-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">+</span>
              <span>Agregar mas productos</span>
            </button>

            {isBalanceZero && (
              <button
                onClick={onFinalize}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-bold text-lg"
              >
                {loading ? 'Finalizando...' : 'Finalizar Pedido'}
              </button>
            )}
          </div>
        )}

        {mode === 'amount' && (
          <div className="space-y-4">
            <button onClick={() => setMode('choose')} className="text-gray-400 hover:text-white text-sm">
              {'<- Volver'}
            </button>

            {/* Resumen de saldo */}
            <div className="bg-gray-900 rounded-xl p-3 flex justify-between items-center">
              <span className="text-gray-400 text-sm">Saldo pendiente</span>
              <span className="text-red-400 font-bold text-xl">${order.balance.toFixed(2)}</span>
            </div>

            {/* Campos de monto - Efectivo y Transferencia */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h4 className="text-gray-300 text-sm font-semibold">Monto a Abonar</h4>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAmountPaymentKind('mixed')}
                  className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-xs font-bold transition-all ${
                    amountPaymentKind === 'mixed'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  Variado
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAmountPaymentKind('cash')}
                  className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-xs font-bold transition-all ${
                    amountPaymentKind === 'cash'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAmountPaymentKind('transfer')}
                  className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-xs font-bold transition-all ${
                    amountPaymentKind === 'transfer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  Transfer
                </button>
              </div>

              {(amountPaymentKind === 'cash' || amountPaymentKind === 'mixed') && (
              <div>
                <label className="flex items-center gap-2 text-green-400 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  <Banknote className="w-4 h-4" />
                  {amountPaymentKind === 'cash' ? 'Efectivo recibido' : 'Efectivo'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-gray-700 text-white text-2xl font-bold rounded-xl border-2 border-gray-600 focus:border-green-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              )}

              {(amountPaymentKind === 'transfer' || amountPaymentKind === 'mixed') && (
              <div>
                <label className="flex items-center gap-2 text-blue-400 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" />
                  Transferencia
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-gray-700 text-white text-2xl font-bold rounded-xl border-2 border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              )}

              {/* Accesos rápidos */}
              {amountPaymentKind === 'mixed' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setCashAmount((order.balance / 2).toFixed(2)); setTransferAmount((order.balance / 2).toFixed(2)); }}
                  className="py-2 bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors"
                >
                  Mitad y mitad
                </button>
                <button
                  type="button"
                  onClick={() => { setCashAmount(order.balance.toFixed(2)); setTransferAmount(''); }}
                  className="py-2 bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors"
                >
                  Limpiar transfer
                </button>
              </div>
              )}
            </div>

            {/* Resumen del cobro */}
            {totalEntered > 0 && (
              <div className="bg-gray-900/80 rounded-xl p-3 space-y-2">
                {cashParsed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-400"><Banknote className="w-3.5 h-3.5 text-green-400" />Efectivo cobrado</span>
                    <span className="text-white font-semibold tabular-nums">${effectiveCash.toFixed(2)}</span>
                  </div>
                )}
                {transferParsed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-400"><Smartphone className="w-3.5 h-3.5 text-blue-400" />Transfer cobrado</span>
                    <span className="text-white font-semibold tabular-nums">${effectiveTransfer.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1.5 border-t border-gray-700">
                  <span className="text-gray-400 font-semibold">Total a cobrar</span>
                  <span className="text-orange-400 font-bold tabular-nums">${amountToCharge.toFixed(2)}</span>
                </div>
                {hasCashChange && (
                  <div className="flex justify-between items-center pt-1.5 border-t border-gray-700">
                    <span className="text-gray-400 text-sm">Vuelto (efectivo)</span>
                    <span className="text-green-400 text-xl font-bold tabular-nums">${cashChange.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Comprobante de transferencia */}
            {transferParsed > 0 && (
              <div className="bg-gray-800 rounded-xl p-4">
                <label className="text-gray-300 text-sm font-medium mb-3 block">
                  Comprobante de Transferencia
                </label>
                {uploadingPhoto ? (
                  <div className="flex items-center justify-center gap-2 p-4 bg-gray-700 rounded-xl text-gray-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Subiendo comprobante...
                  </div>
                ) : receiptPhoto ? (
                  <div className="space-y-3">
                    {receiptPreview && (
                      <img
                        src={receiptPreview}
                        alt="Comprobante"
                        className="w-full max-h-48 object-contain rounded-xl bg-black/30"
                      />
                    )}
                    <div className="flex items-center gap-3 bg-green-950/50 border border-green-700 rounded-xl p-3">
                      <Check className="w-6 h-6 text-green-400" />
                      <span className="text-green-300 text-sm flex-1">Comprobante guardado</span>
                      <button onClick={handleClearReceipt} className="text-gray-400 hover:text-red-400 text-sm">Cambiar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600"
                  >
                    <Camera className="w-5 h-5" />
                    Tomar/Subir Comprobante
                  </button>
                )}
                {photoError && (
                  <p className="mt-2 text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {photoError}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!canProcessAmount || loading}
              className={`w-full py-4 rounded-xl font-bold text-lg ${
                canProcessAmount && !loading
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Procesando...' : `Cobrar $${amountToCharge.toFixed(2)}`}
            </button>
          </div>
        )}

        {mode === 'items' && (
          <div className="space-y-4">
            <button onClick={() => setMode('choose')} className="text-gray-400 hover:text-white text-sm">
              {'<- Volver'}
            </button>

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-gray-300 text-sm font-medium">
                  Selecciona Unidades a Cobrar
                </label>
                <button onClick={handleSelectAll} className="text-orange-400 text-sm hover:text-orange-300">
                  {unpaidItems.every(i => (selectedQuantities.get(i.id) ?? 0) === i.quantity) ? 'Ninguno' : 'Todos'}
                </button>
              </div>

              <div className="space-y-2">
                {order.items.map(item => {
                  const isPaid = item.paid;
                  const selectedQty = selectedQuantities.get(item.id) ?? 0;
                  const unitCost = item.unitPrice + (item.packagingSurcharge / item.quantity);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isPaid
                          ? 'bg-gray-800/40 border border-gray-700/50 opacity-60'
                          : selectedQty > 0
                          ? 'bg-orange-500/20 border border-orange-500'
                          : 'bg-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-white text-sm font-medium truncate ${isPaid ? 'line-through text-gray-500' : ''}`}>
                            {item.productName}
                          </span>
                          {isPaid && (
                            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                              Pagado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-gray-500 text-xs">
                            ${unitCost.toFixed(2)} c/u · {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}
                          </span>
                        </div>
                      </div>

                      {isPaid ? (
                        <span className="text-gray-500 font-bold text-sm">${item.itemTotal.toFixed(2)}</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleSetQuantity(item.id, -1, item.quantity)}
                            disabled={selectedQty === 0}
                            className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5 text-white" />
                          </button>
                          <span className={`w-6 text-center font-bold text-sm ${
                            selectedQty > 0 ? 'text-orange-400' : 'text-gray-500'
                          }`}>
                            {selectedQty}
                          </span>
                          <button
                            onClick={() => handleSetQuantity(item.id, +1, item.quantity)}
                            disabled={selectedQty >= item.quantity}
                            className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                          </button>
                          <span className={`font-bold text-sm w-16 text-right ${
                            selectedQty > 0 ? 'text-white' : 'text-gray-600'
                          }`}>
                            ${(unitCost * selectedQty).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedItemIds.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-600 flex justify-between items-center">
                  <span className="text-gray-400">Total seleccionado:</span>
                  <span className="text-orange-400 font-bold text-lg">${selectedItemTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <label className="text-gray-300 text-sm font-medium mb-3 block">
                Metodo de Pago
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl font-semibold transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  Efectivo
                </button>
                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl font-semibold transition-all ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  Transfer
                </button>
              </div>
            </div>

            {paymentMethod === 'transfer' && (
              <div className="bg-gray-800 rounded-xl p-4">
                <label className="text-gray-300 text-sm font-medium mb-3 block">
                  Comprobante
                </label>
                {uploadingPhoto ? (
                  <div className="flex items-center justify-center gap-2 p-4 bg-gray-700 rounded-xl text-gray-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Subiendo comprobante...
                  </div>
                ) : receiptPhoto ? (
                  <div className="space-y-3">
                    {receiptPreview && (
                      <img
                        src={receiptPreview}
                        alt="Comprobante"
                        className="w-full max-h-48 object-contain rounded-xl bg-black/30"
                      />
                    )}
                    <div className="flex items-center gap-3 bg-green-950/50 border border-green-700 rounded-xl p-3">
                      <Check className="w-6 h-6 text-green-400" />
                      <span className="text-green-300 text-sm flex-1">Comprobante guardado</span>
                      <button
                        onClick={handleClearReceipt}
                        className="text-gray-400 hover:text-red-400 text-sm"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600"
                  >
                    <Camera className="w-5 h-5" />
                    Tomar/Subir Foto
                  </button>
                )}
                {photoError && (
                  <p className="mt-2 text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {photoError}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!canProcessItems || loading}
              className={`w-full py-4 rounded-xl font-bold text-lg ${
                canProcessItems && !loading
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Procesando...' : `Cobrar $${selectedItemTotal.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>

      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-4">Subir Comprobante</h3>
            <div className="space-y-3">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                onClick={handleTakePhoto}
                disabled={uploadingPhoto}
                className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl font-semibold disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                {uploadingPhoto ? 'Subiendo...' : 'Tomar Foto'}
              </button>
              <button
                onClick={handlePickGallery}
                disabled={uploadingPhoto}
                className="w-full flex items-center justify-center gap-2 p-4 bg-gray-700 text-gray-300 rounded-xl font-semibold hover:bg-gray-600 disabled:opacity-50"
              >
                Galeria
              </button>
              <button
                onClick={() => setShowPhotoModal(false)}
                disabled={uploadingPhoto}
                className="w-full p-3 text-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
