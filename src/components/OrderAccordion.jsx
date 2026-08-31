import React, { useState, useEffect, useRef } from 'react';
import { base44, supabase } from '@/api/supabaseClient';
import { formatBRL, formatDate, printOrder, getOrderItemQuantityLabel, getOrderItemSubtotal, getOrderDisplayItems } from '@/lib/format';
import { useSettings } from '@/context/SettingsContext';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Printer, Trash2, Pencil, MapPin, CreditCard, Phone, MessageSquare, Upload, Check, X, FileText, Maximize2 } from 'lucide-react';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

export default function OrderAccordion({ order, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(order.items || []);
  const [uploading, setUploading] = useState(false);
  const [deliverers, setDeliverers] = useState([]);
  const [photoViewOpen, setPhotoViewOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedDeliverer, setSelectedDeliverer] = useState(order.deliverer_id || 'none');
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method_2 ? '2 formas de pagamento' : (order.payment_method || 'Dinheiro'));
  const [paymentMethod1, setPaymentMethod1] = useState(order.payment_method || 'Dinheiro');
  const [paymentMethod2, setPaymentMethod2] = useState(order.payment_method_2 || '');
  const [paymentAmount1, setPaymentAmount1] = useState(String(order.payment_amount_1 ?? order.total ?? ''));
  const [paymentAmount2, setPaymentAmount2] = useState(String(order.payment_amount_2 ?? ''));
  const originalItemsRef = useRef((order.items || []).map(item => ({ ...item })));

  useEffect(() => {
    const nextItems = (order.items || []).map(item => ({ ...item }));
    setItems(nextItems);
    originalItemsRef.current = nextItems;
  }, [order.items]);
  useEffect(() => { setSelectedDeliverer(order.deliverer_id || 'none'); }, [order.deliverer_id]);
  useEffect(() => {
    setPaymentMethod(order.payment_method_2 ? '2 formas de pagamento' : (order.payment_method || 'Dinheiro'));
    setPaymentMethod1(order.payment_method || 'Dinheiro');
    setPaymentMethod2(order.payment_method_2 || '');
    setPaymentAmount1(String(order.payment_amount_1 ?? order.total ?? ''));
    setPaymentAmount2(String(order.payment_amount_2 ?? ''));
  }, [order.payment_method, order.payment_method_2, order.payment_amount_1, order.payment_amount_2, order.total]);

  useEffect(() => {
    base44.entities.User.list().then(users => {
      setDeliverers(users.filter(u => u.role === 'deliverer'));
    }).catch(() => {});
    base44.entities.Product.list().then(setProducts).catch(() => {});
  }, []);

  const buildStockAdjustments = async (previousItems, nextItems) => {
    const oldItems = Array.isArray(previousItems) ? previousItems : [];
    const newItems = Array.isArray(nextItems) ? nextItems : [];
    const products = await base44.entities.Product.list().catch(() => []);
    const productLookupByName = new Map(
      products.map(product => [String(product.name || '').trim().toLowerCase(), product])
    );

    const aggregateItems = (sourceItems) => {
      const map = new Map();
      for (const item of sourceItems) {
        const quantity = Number(item.weight_kg ?? item.quantity ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        const key = item.product_id
          ? `id:${item.product_id}`
          : `name:${String(item.product_name || '').trim().toLowerCase()}|${item.variant_name || ''}|${item.barcode || ''}`;

        const existing = map.get(key) || {
          productId: item.product_id || null,
          productName: item.product_name || '',
          quantity: 0,
        };

        existing.quantity += quantity;
        map.set(key, existing);
      }
      return map;
    };

    const oldMap = aggregateItems(oldItems);
    const newMap = aggregateItems(newItems);
    const allKeys = [...new Set([...oldMap.keys(), ...newMap.keys()])];

    return allKeys.reduce((acc, key) => {
      const oldQty = oldMap.get(key)?.quantity || 0;
      const newQty = newMap.get(key)?.quantity || 0;
      const delta = oldQty - newQty;
      if (delta === 0) return acc;

      let productId = oldMap.get(key)?.productId || newMap.get(key)?.productId || null;
      if (!productId) {
        const match = productLookupByName.get(String(oldMap.get(key)?.productName || newMap.get(key)?.productName || '').trim().toLowerCase());
        productId = match?.id || null;
      }

      if (productId) {
        acc.push({ productId, delta });
      }

      return acc;
    }, []);
  };

  const getItemProduct = (item) => {
    if (!item) return null;
    if (item.product_id) {
      return products.find(p => p.id === item.product_id) || null;
    }

    const normalizedName = String(item.product_name || '').trim().toLowerCase();
    return products.find(p => String(p.name || '').trim().toLowerCase() === normalizedName) || null;
  };

  const getItemStockLimit = (item) => {
    const product = getItemProduct(item);
    const stock = Number(product?.stock_quantity || 0);
    return Number.isFinite(stock) ? Math.max(0, stock) : 0;
  };

  const getItemStep = (item) => {
    const unit = getItemProduct(item)?.unit || '';
    return ['kg', 'g', 'litro', 'L', 'mL'].includes(unit) ? 0.001 : 1;
  };

  const formatWeightQuantity = (value) => {
    if (value === '' || value == null) return '';
    const numeric = Number(String(value).replace(/,/g, '.'));
    if (!Number.isFinite(numeric)) return '';
    return numeric.toFixed(3);
  };

  const { settings } = useSettings();
  // Antes essa lista era fixa no código ("Dinheiro", "Pix", "Cartão débito",
  // "Cartão crédito"), com grafia diferente da lista configurável que o
  // cliente usa no checkout (settings.payment_methods). Se o texto não
  // batesse exatamente (ex: "crédito" x "Crédito"), o <select> não achava
  // a opção certa e mostrava sempre a primeira ("Dinheiro") — mesmo o
  // pedido tendo sido feito com outra forma de pagamento. Agora usa a
  // mesma lista configurada, e sempre inclui a forma de pagamento atual
  // do pedido mesmo que não esteja mais na lista configurada (pedido
  // antigo, ou configuração mudou depois).
  const orderPaymentMethods = Array.from(new Set([
    ...(settings?.payment_methods || ['Pix', 'Dinheiro']),
    ...(order.payment_method ? [order.payment_method] : []),
    ...(order.payment_method_2 ? [order.payment_method_2] : []),
  ]));
  const isPickupOrder = order.delivery_type === 'pickup'
    || (settings?.pickup_address && order.delivery_address === settings.pickup_address);
  const SHIPPING_FEE = settings?.shipping_fee ?? 0;
  const FREE_SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 0;
  const getEffectiveShippingFee = (subtotal) => {
    if (FREE_SHIPPING_THRESHOLD > 0 && subtotal >= FREE_SHIPPING_THRESHOLD) {
      return 0;
    }
    return SHIPPING_FEE;
  };

  const applyQuantityChange = (idx, nextQuantity) => {
    const currentItem = items[idx];
    if (!currentItem) return;

    const normalizedNextQty = Math.max(0, Number(nextQuantity) || 0);
    const stockLimit = getItemStockLimit(currentItem);
    if (normalizedNextQty > stockLimit) return;

    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      quantity: normalizedNextQty,
      weight_kg: getItemStep(it) < 1 ? normalizedNextQty : it.weight_kg,
    } : it));
  };

  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      if (field === 'quantity') {
        const isWeight = ['kg', 'g', 'litro', 'L', 'mL'].includes(getItemProduct(it)?.unit || '');
        const rawValue = value === '' ? '' : String(value).replace(/,/g, '.');
        const numeric = Number(rawValue);
        const quantityValue = rawValue === '' ? '' : (Number.isFinite(numeric) ? rawValue : '');

        return {
          ...it,
          quantity: quantityValue,
          weight_kg: isWeight && Number.isFinite(numeric) ? Math.max(1, numeric) : it.weight_kg,
        };
      }
      if (field === 'price') {
        const numeric = value === '' ? '' : parseFloat(value);
        return { ...it, price: value === '' ? '' : (Number.isFinite(numeric) ? numeric : 0) };
      }
      return it;
    }));
  };

  const handleQuantityBlur = (idx, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const isWeight = ['kg', 'g', 'litro', 'L', 'mL'].includes(getItemProduct(it)?.unit || '');
      if (!isWeight) return it;

      const rawValue = value === '' ? '' : String(value).replace(/,/g, '.');
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) return it;

      const adjusted = Math.max(1, Math.round(numeric * 100) / 100);
      return {
        ...it,
        quantity: adjusted.toFixed(3),
        weight_kg: adjusted,
      };
    }));
  };

  const saveItems = async () => {
    const numericItems = items.map(i => ({
      ...i,
      quantity: parseFloat(i.quantity) || 0,
      price: parseFloat(i.price) || 0,
    }));
    const subtotal = numericItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
    const effectiveShippingFee = getEffectiveShippingFee(subtotal);
    const total = subtotal + effectiveShippingFee;
    const optimisticItems = numericItems.map(item => ({ ...item }));
    const previousItems = originalItemsRef.current.map(item => ({ ...item }));

    setItems(optimisticItems);
    originalItemsRef.current = optimisticItems;
    setEditing(false);

    try {
      const adjustments = await buildStockAdjustments(previousItems, optimisticItems);
      const appliedAdjustments = [];

      for (const adjustment of adjustments) {
        await base44.stock.adjustProductStock({ productId: adjustment.productId, delta: adjustment.delta });
        appliedAdjustments.push(adjustment);
      }

      await base44.entities.Order.update(order.id, { items: optimisticItems, total, shipping_fee: effectiveShippingFee });
      await logAction('Itens do Pedido Editados', `${order.restaurant_name} - ${optimisticItems.length} itens`);
      onUpdate?.();
    } catch (error) {
      for (const adjustment of [...appliedAdjustments].reverse()) {
        try {
          await base44.stock.adjustProductStock({ productId: adjustment.productId, delta: -adjustment.delta });
        } catch (rollbackError) {
          console.error('Erro ao reverter estoque após falha na edição do pedido:', rollbackError);
        }
      }
      setItems(previousItems);
      originalItemsRef.current = previousItems;
      setEditing(true);
      console.error('Erro ao salvar itens do pedido:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar itens do pedido',
        description: error?.message || 'Não foi possível atualizar os itens do pedido e o estoque.',
      });
    }
  };

  const cancelEditing = () => {
    const restoredItems = originalItemsRef.current.map(item => ({ ...item }));
    setItems(restoredItems);
    setEditing(false);
  };

  const deleteItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ATENÇÃO: a baixa de estoque acontece SOMENTE uma vez, no momento em que o
  // cliente confirma o pedido (src/pages/client/Cart.jsx -> handleCheckout).
  // A devolução de estoque acontece SOMENTE ao excluir o pedido
  // (src/pages/admin/Orders.jsx -> handleDelete).
  // Mudar o status aqui (inclusive para "Finalizado") NUNCA deve tocar em
  // estoque — antes esta função baixava de novo ao marcar "Finalizado" e
  // devolvia de novo ao tirar de "Finalizado", causando baixa/devolução
  // duplicada em cima do que o checkout já tinha feito. Não reintroduza essa
  // lógica aqui sem alinhar antes — é a causa raiz do estoque incorreto.
  const changeStatus = async (status) => {
    const nextPayload = {
      status,
      ...(status === 'Finalizado'
        ? { delivery_completed_at: new Date().toISOString(), delivery_status: 'Finalizado' }
        : {
            delivery_status: status === 'Com Entregador' ? 'Aceito' : status === 'Saiu para Entrega' ? 'Saiu para Entrega' : order.delivery_status || 'Pendente',
          }),
    };

    try {
      await base44.entities.Order.update(order.id, nextPayload);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível atualizar o status', description: error.message });
      return;
    }

    if (['Em Separação', 'Saiu para Entrega', 'Finalizado'].includes(status) && order.created_by_id) {
      try {
        await base44.notifications.sendOrderStatusNotification({
          userId: order.created_by_id,
          orderId: order.id,
          status,
          deliverySequence: order.delivery_sequence ?? null,
          restaurantName: order.restaurant_name,
        });
      } catch (error) {
        console.warn('Não foi possível enviar notificação de status do pedido ao cliente:', error);
      }
    }

    if (status === 'Finalizado') {
      try {
        await base44.cash.syncSale({
          orderId: order.id,
          restaurantName: order.restaurant_name,
          invoiceNumber: order.invoice_number,
          total: order.total,
          paymentMethod: order.payment_method,
          paymentMethod2: order.payment_method_2,
          paymentAmount1: order.payment_amount_1,
          paymentAmount2: order.payment_amount_2,
          paymentFees: settings?.payment_fees,
          occurredAt: nextPayload.delivery_completed_at,
        });
      } catch (error) {
        await base44.entities.Order.update(order.id, {
          status: order.status,
          delivery_status: order.delivery_status || 'Pendente',
          delivery_completed_at: null,
        }).catch(() => {});
        toast({ variant: 'destructive', title: 'Venda não lançada no caixa', description: error.message });
        return;
      }
    }
    if (status !== 'Finalizado' && order.status === 'Finalizado') {
      await base44.cash.removeReference('order', order.id);
    }
    await logAction('Status do Pedido Alterado', `${order.restaurant_name}: ${order.status} → ${status}`);
    onUpdate?.();
  };

  const savePayment = async () => {
    const total = Number(order.total || 0);
    const isMulti = paymentMethod === '2 formas de pagamento';
    const first = isMulti ? Number(paymentAmount1 || 0) : total;
    const second = isMulti ? Number(paymentAmount2 || 0) : 0;
    if (!paymentMethod || (isMulti && (!paymentMethod1 || !paymentMethod2 || paymentMethod1 === paymentMethod2 || !paymentAmount1 || !paymentAmount2 || Math.abs(first + second - total) > 0.01))) {
      toast({ variant: 'destructive', title: 'Valores inválidos', description: 'As formas de pagamento precisam somar exatamente o total do pedido.' });
      return;
    }
    try {
      await base44.entities.Order.update(order.id, {
        payment_method: isMulti ? paymentMethod1 : paymentMethod,
        payment_method_2: isMulti ? paymentMethod2 : null,
        payment_amount_1: first,
        payment_amount_2: paymentMethod2 ? second : null,
      });
      toast({ title: 'Pagamento atualizado', description: 'A forma de pagamento do pedido foi alterada.' });
      onUpdate?.();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar pagamento', description: error.message });
    }
  };

  const updateFirstPaymentAmount = (value) => {
    const total = Number(order.total || 0);
    const first = Number(value);
    const remaining = value === '' || !Number.isFinite(first) ? '' : Math.max(0, total - first).toFixed(2);
    setPaymentAmount1(value);
    setPaymentAmount2(remaining);
  };

  const assignDeliverer = async (delivererId) => {
    const previousDeliverer = selectedDeliverer;
    setSelectedDeliverer(delivererId || 'none');
    const deliverer = deliverers.find(d => d.id === delivererId);
    const updates = {
      deliverer_id: delivererId || null,
      deliverer_name: delivererId ? (deliverer?.full_name || deliverer?.email || '') : '',
      delivery_status: 'Pendente',
    };
    try {
      await base44.entities.Order.update(order.id, updates);
      const assignmentChannel = supabase.channel('delivery-assignment-events');
      await new Promise((resolve) => {
        assignmentChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED' || ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) resolve();
        });
      });
      await assignmentChannel.send({
        type: 'broadcast',
        event: 'assignment_changed',
        payload: {
          orderId: order.id,
          previousDelivererId: order.deliverer_id || null,
          newDelivererId: delivererId || null,
        },
      });
      if (delivererId) {
        void base44.notifications.sendDeliveryAssignment({
          delivererId,
          restaurantName: order.restaurant_name,
          invoiceNumber: order.invoice_number,
          total: order.total,
        }).catch(error => console.warn('Não foi possível enviar push ao entregador:', error));
      }
      void supabase.removeChannel(assignmentChannel);
      await logAction('Entregador Atribuído', `${order.restaurant_name}: ${deliverer?.full_name || deliverer?.email || 'Removido'}`);
      onUpdate?.();
    } catch (error) {
      setSelectedDeliverer(previousDeliverer);
      // ERA alert() — dialog síncrona que trava a thread (mesma causa do
      // INP alto que já corrigimos no excluir pedido). Trocado por toast.
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar entregador',
        description: error?.message || 'Não foi possível atualizar o entregador.',
      });
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Order.update(order.id, { delivery_photo_url: file_url });
      onUpdate?.();
    } catch {}
    setUploading(false);
  };

  const itemCount = (order.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{order.restaurant_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-slate-700">{order.invoice_number || 'Sem NF'}</span> • {formatDate(order.created_date)} • {itemCount} {itemCount === 1 ? 'item' : 'itens'} • {formatBRL(order.total)}
          </p>
        </div>
        <StatusBadge status={order.status} />
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">{isPickupOrder ? 'Local de retirada' : 'Endereço de Entrega'}</p><p className="text-slate-700">{isPickupOrder ? 'Retirada na loja' : order.delivery_address}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <CreditCard className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="w-full"><p className="text-slate-400 text-xs">Forma de Pagamento</p><select value={paymentMethod} onChange={e => { const value = e.target.value; setPaymentMethod(value); if (value === '2 formas de pagamento') { setPaymentMethod1(''); setPaymentMethod2(''); setPaymentAmount1(''); setPaymentAmount2(''); } else { setPaymentMethod1(value); setPaymentMethod2(''); } }} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm">{orderPaymentMethods.map(m => <option key={m} value={m}>{m}</option>)}<option>2 formas de pagamento</option></select>{paymentMethod === '2 formas de pagamento' && <div className="mt-2 grid grid-cols-1 gap-2"><div className="grid grid-cols-2 gap-2"><select value={paymentMethod1} onChange={e => setPaymentMethod1(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"><option value="">Escolha a primeira forma</option>{orderPaymentMethods.map(m => <option key={m} value={m}>{m}</option>)}</select><select value={paymentMethod2} onChange={e => setPaymentMethod2(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"><option value="">Escolha a segunda forma</option>{orderPaymentMethods.map(m => <option key={m} value={m}>{m}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="0.01" value={paymentAmount1} onChange={e => updateFirstPaymentAmount(e.target.value)} placeholder="Valor 1" className="h-9 rounded-md border border-slate-200 px-2 text-sm" /><input type="number" min="0" step="0.01" value={paymentAmount2} onChange={e => setPaymentAmount2(e.target.value)} placeholder="Valor 2" className="h-9 rounded-md border border-slate-200 px-2 text-sm" /></div></div>}<Button type="button" size="sm" variant="outline" className="mt-2" onClick={savePayment}>Salvar pagamento</Button></div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">Contato</p><p className="text-slate-700">{order.contact_info || '-'}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">Observações</p><p className="text-slate-700">{order.observations || '-'}</p></div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 bg-slate-50">
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 text-center">Qtd</th>
                  <th className="px-3 py-2 text-right">Preço Unit.</th>
                  <th className="px-3 py-2">Código de Barras</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  {editing && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {(editing ? items : getOrderDisplayItems(order)).map((item, idx) => {
                  const unit = products.find(p => p.name === item.product_name)?.unit || '';
                  const step = getItemStep(item);
                  const quantityValue = item.quantity !== undefined ? item.quantity : 0;
                  const priceValue = item.price !== undefined ? item.price : 0;
                  return (
                    <tr key={idx} className="border-t border-slate-50">
                      <td className="px-3 py-2">{item.product_name}{item.variant_name ? ` - ${item.variant_name}` : ''}</td>
                      <td className="px-3 py-2 text-center">
                        {editing ? (
                          (() => {
                            const isWeightItem = ['kg', 'g', 'litro', 'L', 'mL'].includes(unit);
                            const inputStep = isWeightItem ? 0.01 : step;
                            const inputMin = isWeightItem ? 1 : step;
                            return isWeightItem ? (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  step={inputStep}
                                  min={inputMin}
                                  value={quantityValue}
                                  onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                                  onBlur={(e) => handleQuantityBlur(idx, e.target.value)}
                                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm text-slate-800"
                                />
                                <span className="text-[11px] text-slate-400 whitespace-nowrap">{unit}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => applyQuantityChange(idx, Math.max(0, Number(quantityValue || 0) - step))}
                                  className="h-7 w-7 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={(Number(quantityValue) || 0) <= step}
                                >
                                  −
                                </button>
                                <div className="flex flex-col items-center">
                                  <input
                                    type="number"
                                    step={inputStep}
                                    min={inputMin}
                                    value={quantityValue}
                                    onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm text-slate-800"
                                  />
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{unit}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyQuantityChange(idx, (Number(quantityValue) || 0) + step)}
                                  className="h-7 w-7 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={(Number(quantityValue) || 0) >= getItemStockLimit(item)}
                                >
                                  +
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <span>{getOrderItemQuantityLabel(item)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={priceValue}
                            onChange={(e) => updateItemField(idx, 'price', e.target.value)}
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm text-slate-800"
                          />
                        ) : (
                          <span className="font-mono">{formatBRL(priceValue)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-xs">{item.barcode || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const subtotalValue = getOrderItemSubtotal(item);
                          const f = formatBRL(subtotalValue);
                          const num = f.replace('R$', '').replace(/\u00A0/g, ' ').trim();
                          return (
                            <span className="inline-flex items-center justify-end w-full">
                              <span className="text-slate-700 mr-1">R$</span>
                              <span className="font-mono tabular-nums text-right" style={{minWidth: 64}}>{num}</span>
                            </span>
                          );
                        })()}
                      </td>
                      {editing && (
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => deleteItem(idx)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm py-2 border-t border-slate-100">
            <span className="text-slate-500">Subtotal: <strong className="text-slate-700"><span className="inline-flex items-center"><span className="text-slate-700 mr-1">R$</span><span className="font-mono tabular-nums" style={{minWidth:64}}>{formatBRL((editing ? items : order.items || []).reduce((s, i) => s + getOrderItemSubtotal(i), 0)).replace('R$', '').replace(/\u00A0/g, ' ').trim()}</span></span></strong></span>
            <span className="text-slate-500">Frete: <strong className="text-slate-700">{(order.shipping_fee || 0) > 0 ? (<span className="inline-flex items-center"><span className="text-slate-700 mr-1">R$</span><span className="font-mono tabular-nums" style={{minWidth:64}}>{formatBRL(order.shipping_fee).replace('R$', '').replace(/\u00A0/g, ' ').trim()}</span></span>) : 'Grátis'}</strong></span>
            <span className="text-slate-500">Total: <strong className="text-emerald-600"><span className="inline-flex items-center"><span className="text-slate-700 mr-1">R$</span><span className="font-mono tabular-nums" style={{minWidth:64}}>{formatBRL((editing ? items : order.items || []).reduce((s, i) => s + getOrderItemSubtotal(i), 0) + (order.shipping_fee || 0)).replace('R$', '').replace(/\u00A0/g, ' ').trim()}</span></span></strong></span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 h-9 bg-slate-50 rounded-lg border border-slate-200">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{order.invoice_number || 'Sem NF'}</span>
            </div>
            <Select value={order.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pedido Emitido">Pedido Emitido</SelectItem>
                <SelectItem value="Em Separação">Em Separação</SelectItem>
                <SelectItem value="Com Entregador">Com Entregador</SelectItem>
                <SelectItem value="Saiu para Entrega">Saiu para Entrega</SelectItem>
                {isPickupOrder && <SelectItem value="Pronto para Retirada">Pronto para Retirada</SelectItem>}
                <SelectItem value="Finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">Entregador:</span>
              <Select
                value={selectedDeliverer}
                onValueChange={(v) => assignDeliverer(v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Atribuir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem entregador</SelectItem>
                  {deliverers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name || d.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {order.deliverer_name && order.delivery_status === 'Aceito' && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">
                Entrega aceita por {order.deliverer_name}
              </span>
            )}
            {order.deliverer_name && order.delivery_status === 'Saiu para Entrega' && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full whitespace-nowrap">
                Saiu para entrega — {order.deliverer_name}
              </span>
            )}
            {order.deliverer_name && order.delivery_status === 'Finalizado' && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">
                Entrega finalizada por {order.deliverer_name}
              </span>
            )}
            {order.deliverer_name && order.delivery_status === 'Pendente' && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">
                Pendente — {order.deliverer_name}
              </span>
            )}

            {editing ? (
              <>
                <Button onClick={saveItems} size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9">
                  <Check className="w-4 h-4 mr-1" /> Salvar Itens
                </Button>
                <Button onClick={cancelEditing} variant="outline" size="sm" className="h-9">
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              </>
            ) : (
              <Button onClick={() => {
                const nextItems = (order.items || []).map(item => ({ ...item }));
                originalItemsRef.current = nextItems;
                setItems(nextItems);
                setEditing(true);
              }} variant="outline" size="sm" className="h-9">
                <Pencil className="w-4 h-4 mr-1" /> Editar Itens
              </Button>
            )}

            <Button onClick={() => printOrder(order, settings)} variant="outline" size="sm" className="h-9">
              <Printer className="w-4 h-4 mr-1" /> Imprimir 2 Vias
            </Button>

            <label className="inline-flex items-center gap-1.5 px-3 h-9 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Foto Comprovante'}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>

            {order.delivery_photo_url && (
              <button
                onClick={() => setPhotoViewOpen(true)}
                className="relative group"
                title="Ver comprovante em tela cheia"
              >
                <img src={order.delivery_photo_url} alt="Comprovante" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg flex items-center justify-center transition-colors">
                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            )}

            <Dialog open={photoViewOpen} onOpenChange={(o) => setPhotoViewOpen(o)}>
              <DialogContent className="sm:max-w-2xl p-2">
                <DialogTitle className="sr-only">Comprovante de Entrega</DialogTitle>
                {order.delivery_photo_url && (
                  <img src={order.delivery_photo_url} alt="Comprovante de entrega" className="w-full h-auto rounded-lg" />
                )}
                <div className="text-center text-sm text-slate-500 pb-2 pt-1">
                  Comprovante — {order.restaurant_name} • {order.invoice_number || 'Sem NF'}
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => onDelete(order)}
              variant="outline"
              size="sm"
              className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Excluir Pedido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}