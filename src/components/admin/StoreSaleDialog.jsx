import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44, supabase } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/lib/AuthContext';
import { formatBRL } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QuantitySelector from '@/components/QuantitySelector';
import { toast } from '@/components/ui/use-toast';
import { maskPhone, maskCEP } from '@/lib/masks';
import { Loader2, Search, Package, Trash2, Truck, Store } from 'lucide-react';

const WEIGHT_UNITS = ['kg', 'g', 'litro', 'L', 'mL'];
const isWeightUnit = (unit) => !!unit && WEIGHT_UNITS.includes(unit);

const emptyCustomer = {
  name: '', phone: '',
  zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '',
  address_note: '',
};

// Venda de balcão: o cliente está na loja e não quer criar conta.
// Usa o MESMO fluxo do checkout do cliente (RPC create_order_with_stock_deduction),
// então estoque, número da NF e regras de frete se comportam igual. O pedido cai
// em "Pedido Emitido" na aba Pedidos. O carrinho aqui é LOCAL (não mexe no
// carrinho/localStorage da loja).
export default function StoreSaleDialog({ open, onClose, onCreated }) {
  const { settings } = useSettings();
  const { user: authUser } = useAuth();

  const paymentMethods = settings?.payment_methods || ['Pix', 'Dinheiro'];
  const SHIPPING_FEE = settings?.shipping_fee ?? 20;
  const FREE_SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 200;
  const pickupAddress = settings?.pickup_address?.trim() || '';

  const [tab, setTab] = useState('customer'); // 'customer' | 'items'
  const [customer, setCustomer] = useState(emptyCustomer);
  const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' | 'pickup'
  const [paymentMethod, setPaymentMethod] = useState('');
  const [observations, setObservations] = useState('');

  const [products, setProducts] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [categories, setCategories] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const numberRef = useRef(null);
  const [cepLoading, setCepLoading] = useState(false);

  // Carrega o catálogo só quando o diálogo abre; zera o formulário ao abrir.
  useEffect(() => {
    if (!open) return;
    setTab('customer');
    setCustomer(emptyCustomer);
    setDeliveryType('delivery');
    setPaymentMethod('');
    setObservations('');
    setItems([]);
    setSearch('');
    setCategory('');

    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      try {
        const [prods, variants, cats] = await Promise.all([
          base44.entities.Product.list(),
          base44.entities.ProductVariant.list('sort_order').catch(() => []),
          base44.entities.Category.list('name').catch(() => []),
        ]);
        if (cancelled) return;
        const byProduct = {};
        for (const v of variants || []) {
          (byProduct[v.product_id] = byProduct[v.product_id] || []).push(v);
        }
        setProducts((prods || []).filter(p => (p.price || 0) > 0));
        setVariantsByProduct(byProduct);
        setCategories(cats || []);
      } catch (err) {
        console.error('Erro ao carregar catálogo da venda na loja:', err);
      }
      if (!cancelled) setLoadingCatalog(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Linhas vendáveis: produto sem variação = 1 linha; com variação = 1 linha por variação.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = [];
    for (const p of products) {
      if (category && p.category !== category) continue;
      if (term && !p.name?.toLowerCase().includes(term)) continue;
      const variants = variantsByProduct[p.id] || [];
      if (variants.length > 0) {
        variants.forEach(v => list.push({ product: p, variant: v }));
      } else {
        list.push({ product: p, variant: null });
      }
    }
    return list;
  }, [products, variantsByProduct, search, category]);

  const findItem = (productId, variantId) =>
    items.find(i => i.product_id === productId && (i.variant_id || null) === (variantId || null));

  const addItem = (product, variant) => {
    const unitWeight = variant?.default_weight_kg ?? product.default_weight_kg ?? null;
    const weight = isWeightUnit(product.unit);
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      variant_id: variant?.id || null,
      variant_name: variant?.name || null,
      name: variant ? `${product.name} - ${variant.name}` : product.name,
      price: variant ? variant.price : product.price,
      quantity: 1,
      weight_kg: weight ? (unitWeight != null ? unitWeight : 1) : null,
      weight_per_unit_kg: unitWeight,
      unit: product.unit,
      stock_quantity: product.stock_quantity,
      image_url: product.image_url,
      barcode: product.barcode,
    }]);
  };

  const updateQuantity = (productId, variantId, qty) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => !(i.product_id === productId && (i.variant_id || null) === (variantId || null))));
      return;
    }
    setItems(prev => prev.map(i => {
      if (i.product_id !== productId || (i.variant_id || null) !== (variantId || null)) return i;
      return {
        ...i,
        quantity: qty,
        weight_kg: isWeightUnit(i.unit)
          ? (i.weight_per_unit_kg != null ? qty * i.weight_per_unit_kg : qty)
          : i.weight_kg,
      };
    }));
  };

  // Mesma conta do CartContext.
  const subtotal = items.reduce((s, i) => {
    const effectiveQty = isWeightUnit(i.unit)
      ? (Number(i.weight_kg || 0) > 0 ? Number(i.weight_kg) : Number(i.quantity || 0))
      : Number(i.quantity || 0);
    return s + Number(i.price || 0) * effectiveQty;
  }, 0);

  // Frete: retirada na loja = grátis; entrega = grátis se subtotal >= valor definido em Configurações.
  const shippingFee = deliveryType === 'pickup' ? 0 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
  const grandTotal = subtotal + shippingFee;
  const missingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const itemCount = items.length;

  // Digitou os 8 dígitos do CEP -> preenche rua, bairro, cidade e UF (ViaCEP).
  // Se falhar (sem internet, CEP genérico), o campo continua editável à mão.
  const handleCepChange = async (value) => {
    const masked = maskCEP(value);
    setCustomer(prev => ({ ...prev, zip_code: masked }));
    const digits = masked.replace(/\D/g, '');
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!res.ok || data.erro) {
        toast({ variant: 'destructive', title: 'CEP não encontrado', description: 'Preencha o endereço manualmente.' });
      } else {
        setCustomer(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
        }));
        setTimeout(() => numberRef.current?.focus(), 50);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível buscar o CEP', description: 'Preencha o endereço manualmente.' });
    }
    setCepLoading(false);
  };

  const handleFinish = async () => {
    if (submittingRef.current) return;

    if (!customer.name.trim()) {
      setTab('customer');
      toast({ variant: 'destructive', title: 'Informe o nome do cliente' });
      return;
    }
    const phoneDigits = customer.phone.replace(/\D/g, '').length;
    if (phoneDigits > 0 && phoneDigits < 10) {
      setTab('customer');
      toast({ variant: 'destructive', title: 'Telefone incompleto', description: 'Digite o DDD + número.' });
      return;
    }
    if (deliveryType === 'delivery' && (!customer.street.trim() || !customer.number.trim())) {
      setTab('customer');
      toast({ variant: 'destructive', title: 'Informe rua e número', description: 'Ou troque para "Retirar na loja".' });
      return;
    }
    if (!paymentMethod) {
      setTab('customer');
      toast({ variant: 'destructive', title: 'Selecione a forma de pagamento' });
      return;
    }
    if (items.length === 0) {
      setTab('items');
      toast({ variant: 'destructive', title: 'Adicione ao menos um produto' });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const currentUser = authUser || await base44.auth.me().catch(() => null);
      if (!currentUser?.id) throw new Error('Sessão expirada. Entre novamente.');

      const orderItems = items.map(i => {
        const weight = isWeightUnit(i.unit);
        const unitWeight = i.weight_per_unit_kg != null ? Number(i.weight_per_unit_kg) : null;
        const qty = Number(i.quantity || 0);
        return {
          product_id: i.product_id || null,
          product_name: i.product_name || i.name,
          quantity: qty,
          barcode: i.barcode || '',
          price: i.price,
          image_url: i.image_url || null,
          variant_id: i.variant_id || null,
          variant_name: i.variant_name || null,
          weight_kg: weight ? (unitWeight != null ? qty * unitWeight : qty) : null,
          weight_per_unit_kg: unitWeight,
        };
      });

      const { data: invoiceData, error: invoiceError } = await supabase.rpc('next_invoice_number');
      if (invoiceError || !invoiceData) throw new Error('Não foi possível gerar o número do pedido.');
      const invoiceNumber = `NF-${String(invoiceData).replace(/^NF-/i, '')}`;

      const deliveryAddress = deliveryType === 'pickup'
        ? (pickupAddress || 'Retirada na loja')
        : [
            [customer.street, customer.number, customer.complement, customer.neighborhood, customer.city, customer.zip_code]
              .map(v => v.trim()).filter(Boolean).join(', '),
            customer.address_note.trim(),
          ].filter(Boolean).join(' - ');

      const customerName = customer.name.trim();
      const obs = ['[Venda na loja]', observations.trim()].filter(Boolean).join(' ');

      const { data: createdOrder, error: orderError } = await supabase.rpc('create_order_with_stock_deduction', {
        p_order: {
          created_by_id: currentUser.id,
          account_name: customerName,
          restaurant_name: customerName,
          restaurant_cnpj: '',
          invoice_number: invoiceNumber,
          status: 'Pedido Emitido',
          delivery_address: deliveryAddress,
          delivery_type: deliveryType,
          payment_method: paymentMethod,
          contact_info: customer.phone.trim() ? `Telefone: ${customer.phone.trim()}` : '',
          observations: obs,
          total: grandTotal,
          shipping_fee: shippingFee,
        },
        p_items: orderItems,
      });
      if (orderError) throw new Error(orderError.message || 'Não foi possível finalizar a venda.');

      // Mesmo reforço do checkout do cliente: garante tipo de entrega e pagamento.
      const createdOrderId = createdOrder?.id
        || createdOrder?.order?.id
        || createdOrder?.[0]?.id
        || (typeof createdOrder === 'string' ? createdOrder : null);
      let upd = supabase.from('orders').update({ delivery_type: deliveryType, payment_method: paymentMethod });
      upd = createdOrderId ? upd.eq('id', createdOrderId) : upd.eq('invoice_number', invoiceNumber);
      const { error: updError } = await upd;
      if (updError) throw new Error(updError.message || 'Não foi possível salvar o pagamento do pedido.');

      void logAction('Venda na Loja', `${customerName} - ${formatBRL(grandTotal)} - Pedido #${createdOrder?.invoice_number || invoiceNumber}`);

      toast({
        title: 'Venda registrada',
        description: 'O pedido já está na aba Pedidos.',
        className: 'border-green-700 bg-green-600 text-white',
      });
      onCreated?.();
      onClose();
    } catch (err) {
      console.error('Erro na venda na loja:', err);
      toast({ variant: 'destructive', title: 'Erro ao registrar venda', description: err.message });
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const tabBtn = (value, label) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${tab === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 p-4 pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-lg">Nova venda na loja</DialogTitle>
              <DialogDescription className="text-xs">Cliente no balcão, sem login.</DialogDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              {tabBtn('customer', 'Informações do cliente')}
              {tabBtn('items', `Lista de pedido${itemCount ? ` (${itemCount})` : ''}`)}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'customer' ? (
            <div className="space-y-4">
              <div>
                <Label>Como o cliente vai receber? *</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${deliveryType === 'pickup' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-1 font-semibold"><Store className="w-4 h-4" /> Retirar na loja</span>
                    <span className="mt-1 block text-xs">Frete grátis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${deliveryType === 'delivery' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-1 font-semibold"><Truck className="w-4 h-4" /> Entregar</span>
                    <span className="mt-1 block text-xs">Frete conforme Configurações</span>
                  </button>
                </div>
              </div>

              <div>
                <Label>Nome do cliente *</Label>
                <Input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} className="mt-1" placeholder="Nome" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: maskPhone(e.target.value) })} className="mt-1" inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" />
                {customer.phone && customer.phone.replace(/\D/g, '').length < 10 && (
                  <p className="mt-1 text-xs text-amber-600">Digite o DDD + número (10 ou 11 dígitos)</p>
                )}
              </div>

              {deliveryType === 'delivery' && (
                <>
                  <div>
                    <Label>CEP</Label>
                    <div className="relative mt-1">
                      <Input value={customer.zip_code} onChange={e => handleCepChange(e.target.value)} inputMode="numeric" placeholder="00000-000" />
                      {cepLoading && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Digite o CEP e o endereço é preenchido sozinho.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label>Rua *</Label>
                      <Input value={customer.street} onChange={e => setCustomer({ ...customer, street: e.target.value })} className="mt-1" placeholder="Nome da rua" />
                    </div>
                    <div>
                      <Label>Número *</Label>
                      <Input ref={numberRef} value={customer.number} onChange={e => setCustomer({ ...customer, number: e.target.value })} className="mt-1" placeholder="Nº" />
                    </div>
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input value={customer.complement} onChange={e => setCustomer({ ...customer, complement: e.target.value })} className="mt-1" placeholder="Apto, bloco, sala..." />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input value={customer.neighborhood} onChange={e => setCustomer({ ...customer, neighborhood: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Observação do endereço</Label>
                    <Input value={customer.address_note} onChange={e => setCustomer({ ...customer, address_note: e.target.value })} className="mt-1" placeholder="Ex: portão azul, tocar interfone" />
                  </div>
                </>
              )}

              <div>
                <Label>Forma de pagamento *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações do pedido (opcional)</Label>
                <Textarea value={observations} onChange={e => setObservations(e.target.value)} className="mt-1" rows={2} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto..." className="pl-9" />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${category === '' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                >
                  Todas
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${category === c.name ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {loadingCatalog ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Nenhum produto encontrado</p>
              ) : (
                <div className="space-y-2">
                  {rows.map(({ product, variant }) => {
                    const inList = findItem(product.id, variant?.id);
                    const weight = isWeightUnit(product.unit);
                    const unitWeight = variant?.default_weight_kg ?? product.default_weight_kg ?? null;
                    const price = variant ? variant.price : product.price;
                    return (
                      <div key={product.id + (variant?.id || '')} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="w-12 h-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center">
                          {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{product.name}{variant ? ` - ${variant.name}` : ''}</p>
                          <p className="text-xs text-slate-500">
                            {formatBRL(price)}{product.stock_quantity != null ? ` • estoque: ${product.stock_quantity}${product.unit ? ` ${product.unit}` : ''}` : ''}
                          </p>
                        </div>
                        {inList ? (
                          <div className="flex items-center gap-1">
                            <QuantitySelector
                              value={inList.quantity}
                              onChange={v => updateQuantity(product.id, variant?.id || null, v)}
                              min={weight ? (unitWeight ? 1 : 0.1) : 1}
                              max={product.stock_quantity}
                              step={weight ? (unitWeight ? 1 : 0.1) : 1}
                              size="sm"
                            />
                            <button type="button" onClick={() => updateQuantity(product.id, variant?.id || null, 0)} className="p-2 text-slate-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <Button type="button" size="sm" onClick={() => addItem(product, variant)} className="bg-emerald-600 hover:bg-emerald-700">
                            Adicionar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'itens'})</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1 text-slate-500"><Truck className="w-3.5 h-3.5" /> {deliveryType === 'pickup' ? 'Retirada' : 'Frete'}</span>
            <span className={shippingFee === 0 ? 'font-medium text-emerald-600' : 'text-slate-600'}>
              {shippingFee === 0 ? 'GRÁTIS' : formatBRL(shippingFee)}
            </span>
          </div>
          {deliveryType === 'delivery' && shippingFee > 0 && itemCount > 0 && (
            <p className="text-xs text-amber-600">Faltam {formatBRL(missingForFree)} para frete grátis</p>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-bold text-emerald-600">{formatBRL(grandTotal)}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
              <Button type="button" onClick={handleFinish} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finalizar venda'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
