import React, { useEffect, useState } from 'react';
import { base44, supabase } from '@/api/supabaseClient';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { formatBRL } from '@/lib/format';
import { maskPhone, maskCNPJ, maskCEP } from '@/lib/masks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AuthModal from '@/components/AuthModal';
import ProfileEditDialog from '@/components/client/ProfileEditDialog';
import QuantitySelector from '@/components/QuantitySelector';
import { Trash2, ShoppingBag, Loader2, CheckCircle, Store, MapPin, CreditCard, Package, Truck, X, MoreVertical, Info, Scale } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logAction } from '@/lib/audit';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

export default function Cart() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();
  const { settings } = useSettings();
  const { user: authUser, restaurantProfile } = useAuth();
  const paymentMethods = settings?.payment_methods || ['Pix', 'Dinheiro'];
  const SHIPPING_FEE = settings?.shipping_fee ?? 20;
  const FREE_SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 200;
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(restaurantProfile || null);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profileForm, setProfileForm] = useState({
    restaurant_name: '', cnpj: '', contact_number: '',
    street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '',
  });
  const [checkoutForm, setCheckoutForm] = useState({ delivery_address: '', payment_method: '', observations: '' });
  const [addresses, setAddresses] = useState([]);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showCostInfo, setShowCostInfo] = useState(false);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [savingList, setSavingList] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isCheckoutPage = location.pathname === '/loja/finalizar-pedido';
  const isCartPage = location.pathname === '/loja/carrinho';

  const shippingFee = total >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const grandTotal = total + shippingFee;
  const freeShippingDifference = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
  const showFreeShippingMessage = total < FREE_SHIPPING_THRESHOLD;

  const shippingItem = shippingFee > 0 && items.length > 0 ? {
    product_id: null,
    product_name: 'Frete',
    name: 'Frete',
    price: shippingFee,
    quantity: 1,
    barcode: '',
    variant_id: null,
    variant_name: null,
    unit: null,
    stock_quantity: 1,
    isShippingItem: true,
  } : null;

  const displayItems = shippingItem ? [...items, shippingItem] : items;

  const applyRestaurantProfile = (profile) => {
    if (!profile) return;
    setRestaurant(profile);
    setProfileForm({
      restaurant_name: profile.restaurant_name || '', cnpj: profile.cnpj || '', contact_number: profile.contact_number || '',
      street: profile.street || '', number: profile.number || '', complement: profile.complement || '',
      neighborhood: profile.neighborhood || '', city: profile.city || '', state: profile.state || '', zip_code: profile.zip_code || '',
    });
    const fullAddr = buildFullAddress(profile);
    setCheckoutForm(prev => ({ ...prev, delivery_address: fullAddr }));
  };

  const checkUser = async () => {
    try {
      const currentUser = authUser || await base44.auth.me();
      setUser(currentUser);

      if (restaurantProfile) {
        applyRestaurantProfile(restaurantProfile);
      } else {
        const restaurants = await base44.entities.Restaurant.filter({ user_id: currentUser.id });
        if (restaurants.length > 0) {
          applyRestaurantProfile(restaurants[0]);
        }
      }

      const extraAddrs = await base44.entities.Address.filter({ user_id: currentUser.id }).catch(() => []);
      setAddresses(extraAddrs || []);
    } catch {}
  };

  useEffect(() => {
    checkUser();
  }, [authUser, restaurantProfile]);

  // Função auxiliar para formatar o endereço completo
  const buildFullAddress = (f) => [f.street, f.number, f.complement, f.neighborhood, f.city, f.state, f.zip_code].filter(Boolean).join(', ');

  const getSavedAddress = (address) => address?.address?.trim() || buildFullAddress(address);
  const getAddressSummary = (address) => getSavedAddress(address).split(',').map(part => part.trim()).filter(Boolean).slice(0, 2).join(', ');

  const saveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fullAddr = buildFullAddress(profileForm);
      const created = await base44.entities.Restaurant.create({
        ...profileForm,
        address: fullAddr,
        account_name: user.email,
        user_id: user.id,
      });
      setRestaurant(created);
      setCheckoutForm(prev => ({ ...prev, delivery_address: fullAddr }));
    } catch {}
    setSubmitting(false);
  };

  const generateInvoiceNumber = async () => {
    const allOrders = await base44.entities.Order.list('-created_date', 200);
    const nfNumbers = allOrders
      .map(o => o.invoice_number)
      .filter(nf => nf && nf.startsWith('NF-'))
      .map(nf => parseInt(nf.replace('NF-', ''), 10))
      .filter(n => !isNaN(n));
    const maxNum = nfNumbers.length > 0 ? Math.max(...nfNumbers) : 1000;
    return `NF-${maxNum + 1}`;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!checkoutForm.delivery_address) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, selecione um endereço de entrega antes de finalizar o pedido.'
      });
      return;
    }

    if (!checkoutForm.payment_method) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, selecione uma forma de pagamento antes de finalizar o pedido.'
      });
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = items.map(i => {
        const isWeightProduct = i.unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(i.unit);
        const unitWeight = i.weight_per_unit_kg != null ? Number(i.weight_per_unit_kg) : null;
        const quantityUnits = Number(i.quantity || 0);
        const effectiveWeight = isWeightProduct
          ? (unitWeight != null ? quantityUnits * unitWeight : quantityUnits)
          : null;

        return {
          product_id: i.product_id || null,
          product_name: i.product_name || i.name,
          quantity: quantityUnits,
          barcode: i.barcode || '',
          price: i.price,
          image_url: i.image_url || null,
          variant_id: i.variant_id || null,
          variant_name: i.variant_name || null,
          weight_kg: effectiveWeight,
          weight_per_unit_kg: unitWeight,
        };
      });

      // Reduz o estoque de cada produto via RPC segura no banco antes de criar o pedido
      for (const item of orderItems) {
        if (!item.product_id) continue;

        const qtyToDeduct = Number(item.weight_kg != null ? item.weight_kg : item.quantity || 0);
        if (qtyToDeduct <= 0) continue;

        const result = await base44.stock.decrementStock({
          productId: item.product_id,
          quantity: qtyToDeduct,
        });

        if (result === false) {
          throw new Error(`Estoque insuficiente para ${item.product_name}`);
        }
      }

      const invoiceNumber = await generateInvoiceNumber();
      const createdOrder = await base44.entities.Order.create({
        created_by_id: user.id,
        restaurant_name: restaurant.restaurant_name,
        restaurant_cnpj: restaurant.cnpj || '',
        invoice_number: invoiceNumber,
        status: 'Pedido Emitido',
        delivery_address: checkoutForm.delivery_address,
        payment_method: checkoutForm.payment_method,
        contact_info: restaurant.contact_number,
        observations: checkoutForm.observations,
        items: orderItems,
        total: grandTotal,
        shipping_fee: shippingFee,
      });

      await logAction('Pedido Criado', `${restaurant.restaurant_name} - ${formatBRL(grandTotal)} - Pedido #${createdOrder?.invoice_number || '-'}`);

      clearCart();
      setSuccess(true);
      setTimeout(() => navigate('/loja/pedidos'), 2500);
    } catch (err) {
      console.error('Error creating order:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar pedido',
        description: err.message || 'Ocorreu um erro ao processar seu pedido. Por favor, tente novamente.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearCart = () => {
    clearCart();
    setConfirmClear(false);
    setMenuOpen(false);
  };

  const handleOpenSaveList = async () => {
    setMenuOpen(false);
    try {
      await base44.auth.me();
      setNewListName(`Lista de ${new Date().toLocaleDateString('pt-BR')}`);
      setSaveListOpen(true);
    } catch {
      navigate('/login');
    }
  };

  const handleConfirmSaveList = async () => {
    if (!newListName.trim()) return;
    setSavingList(true);
    try {
      const u = await base44.auth.me();
      const list = await base44.entities.List.create({ user_id: u.id, name: newListName.trim() });
      for (const item of items) {
        await base44.entities.ListItem.create({ list_id: list.id, product_id: item.product_id, quantity: item.quantity }).catch(() => {});
      }
      setSaveListOpen(false);
      navigate('/loja/listas');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar lista', description: err.message });
    }
    setSavingList(false);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Pedido Enviado!</h2>
        <p className="text-sm text-slate-500">Seu pedido foi recebido e está sendo processado.</p>
        <p className="text-xs text-slate-400 mt-2">Redirecionando para seus pedidos...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Carrinho Vazio</h2>
        <p className="text-sm text-slate-500 mb-4">Adicione produtos ao carrinho para continuar</p>
        <Button onClick={() => navigate('/loja')} className="bg-emerald-600 hover:bg-emerald-700">Ver Produtos</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Carrinho</h1>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[180px] overflow-hidden">
                <button onClick={handleOpenSaveList} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                  Salvar na lista
                </button>
                <button onClick={() => { setConfirmClear(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100">
                  Esvaziar carrinho
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${isCheckoutPage ? 'lg:grid-cols-[minmax(0,1fr)_360px] mx-auto max-w-6xl' : isCartPage ? 'grid-cols-1' : 'lg:grid-cols-3'}`}>
        <div className={`${isCheckoutPage ? '' : isCartPage ? 'flex flex-col h-[calc(100vh-7rem)] overflow-hidden' : 'lg:col-span-2'} min-w-0 ${isCartPage ? '' : 'space-y-3'}`}>
          <div className={`${isCartPage ? 'flex-1 overflow-y-auto space-y-3' : 'space-y-3'}`}>
            {displayItems.map(item => (
              item.isShippingItem ? (
                <div key={item.product_id} className={`bg-white rounded-xl border border-slate-200 flex items-center gap-3 ${isCartPage ? 'flex-wrap p-3' : 'p-4 gap-4'}`}>
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{item.name}</p>
                    <p className="text-sm text-slate-500">{formatBRL(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">1x</span>
                  </div>
                  <p className={`${isCartPage ? 'hidden' : 'hidden sm:block'} font-semibold text-slate-900 w-20 text-right`}>
                    {formatBRL(item.price)}
                  </p>
                </div>
              ) : (
                <div key={item.product_id + (item.variant_id || '')} className={`bg-white rounded-xl border border-slate-200 flex items-center gap-3 ${isCartPage ? 'flex-wrap p-3' : 'p-4 gap-4'}`}>
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                    {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{item.name}</p>
                    <p className="text-sm text-slate-500">{formatBRL(item.price)}{item.variant_name ? ` / ${item.variant_name}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <QuantitySelector
                      value={item.quantity}
                      onChange={v => updateQuantity(item.product_id, v, item.variant_id)}
                      min={(item.unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(item.unit)) ? (item.weight_per_unit_kg ? 1 : 0.1) : 1}
                      max={item.stock_quantity}
                      step={(item.unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(item.unit)) ? (item.weight_per_unit_kg ? 1 : 0.1) : 1}
                      size="sm"
                    />
                    <button onClick={() => removeItem(item.product_id, item.variant_id)} className="p-2 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className={`${isCartPage ? 'hidden' : 'hidden sm:block'} font-semibold text-slate-900 w-20 text-right`}>
                    {formatBRL(item.price * ((item.weight_per_unit_kg != null ? item.quantity * item.weight_per_unit_kg : item.quantity) || 0))}
                  </p>
                </div>
              )
            ))}
          </div>

          {isCartPage && (
            <div className="border-t border-slate-200 bg-background/95 p-4 lg:bg-white lg:p-5 lg:shadow-sm">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      Total aproximado
                      <button type="button" title="Para produtos vendidos por peso, o valor final pode variar após a separação." onClick={() => setShowCostInfo(true)} className="text-slate-400 hover:text-emerald-600 lg:pointer-events-none"><Info className="h-3.5 w-3.5" /></button>
                    </span>
                    <p className="text-xs text-slate-500">Valor aproximado do pedido. Se sua compra tem algum produto vendido por peso, o total final pode ser ajustado ao preparar sua compra.</p>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{formatBRL(grandTotal)}</span>
                </div>
                {showFreeShippingMessage && (
                  <p className="mt-3 text-xs font-medium text-amber-500">Faltam {formatBRL(freeShippingDifference)} para frete grátis</p>
                )}
                {shippingFee > 0 && (
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                    <span>Frete</span>
                    <span>{formatBRL(shippingFee)}</span>
                  </div>
                )}
                <p className="mt-3 text-xs font-medium text-emerald-600">Frete grátis para compras superiores a {formatBRL(FREE_SHIPPING_THRESHOLD)}</p>
                <Button onClick={() => navigate('/loja/finalizar-pedido')} className="mt-4 h-11 w-full bg-emerald-600 font-semibold hover:bg-emerald-700">Prosseguir com pedido</Button>
              </div>
            </div>
          )}
        </div>

        {!isCartPage && (
          <div className={`${isCheckoutPage ? '' : 'lg:col-span-1'} min-w-0`}>
            {!isCheckoutPage ? (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        Total aproximado
                        <button type="button" title="Para produtos vendidos por peso, o valor final pode variar após a separação." onClick={() => setShowCostInfo(true)} className="text-slate-400 hover:text-emerald-600 lg:pointer-events-none">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </span>
                      <p className="text-xs text-slate-400">O preço pode variar de acordo com produtos vendidos por peso.</p>
                    </div>
                    <span className="text-xl font-bold text-slate-900">{formatBRL(grandTotal)}</span>
                  </div>
                  {showFreeShippingMessage && (
                    <p className="mt-3 text-xs font-medium text-amber-500">Faltam {formatBRL(freeShippingDifference)} para frete grátis</p>
                  )}
                  {shippingFee > 0 && (
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                      <span>Frete</span>
                      <span>{formatBRL(shippingFee)}</span>
                    </div>
                  )}
                  <p className="mt-3 text-xs font-medium text-emerald-600">Frete grátis para compras superiores a {formatBRL(FREE_SHIPPING_THRESHOLD)}</p>
                  <Button onClick={() => navigate('/loja/finalizar-pedido')} className="mt-4 h-11 w-full bg-emerald-600 font-semibold hover:bg-emerald-700">
                    Prosseguir com pedido
                  </Button>
                </div>
              </div>
            ) : !user ? (
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Store className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Faça login para continuar</h3>
                <p className="text-sm text-slate-500 mb-4">Você precisa estar logado para finalizar o pedido</p>
                <Button onClick={() => setShowAuth(true)} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Entrar / Cadastrar
                </Button>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Total</span>
                    <span className="font-bold text-slate-900">{formatBRL(grandTotal)}</span>
                  </div>
                </div>
              </div>
            ) : !restaurant ? (
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Store className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Complete seu cadastro</h3>
                <p className="text-sm text-slate-500 mb-4">Antes de concluir o pedido, precisamos dos dados do seu restaurante e do endereço de entrega.</p>
                <Button onClick={() => setProfileDialogOpen(true)} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Preencher
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-20">
                <h3 className="font-semibold text-slate-900 mb-4">Finalizar Pedido</h3>
                <form onSubmit={handleCheckout} className="space-y-3">
                  <div>
                    <Label>
                      <MapPin className="w-3.5 h-3.5 inline mr-1" />
                      Endereco de entrega *
                    </Label>
                    <Select value={checkoutForm.delivery_address} onValueChange={v => setCheckoutForm({ ...checkoutForm, delivery_address: v })}>
                      <SelectTrigger className="mt-1 h-11 min-w-0">
                        <SelectValue placeholder="Selecione o endereco" />
                      </SelectTrigger>
                      <SelectContent className="w-[min(92vw,420px)] max-w-[calc(100vw-2rem)]">
                        <SelectItem
                          value={getSavedAddress(restaurant)}
                          textValue={`Endereco 1 - ${getAddressSummary(restaurant)}`}
                          className="items-start py-3"
                        >
                          <span className="flex min-w-0 flex-col gap-0.5 pr-2">
                            <span className="font-medium">Endereco 1 (principal)</span>
                            <span className="line-clamp-2 text-xs font-normal text-slate-500">{getSavedAddress(restaurant)}</span>
                          </span>
                        </SelectItem>
                        {addresses.map(a => (
                          <SelectItem
                            key={a.id}
                            value={getSavedAddress(a)}
                            textValue={`${a.label || 'Endereco 2'} - ${getAddressSummary(a)}`}
                            className="items-start py-3"
                          >
                            <span className="flex min-w-0 flex-col gap-0.5 pr-2">
                              <span className="font-medium">{a.label || 'Endereco 2'}</span>
                              <span className="line-clamp-2 text-xs font-normal text-slate-500">{getSavedAddress(a)}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>
                      <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                      Forma de Pagamento Na Entrega *
                    </Label>
                    <Select value={checkoutForm.payment_method} onValueChange={v => setCheckoutForm({ ...checkoutForm, payment_method: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Observacoes (opcional)</Label>
                    <Textarea value={checkoutForm.observations} onChange={e => setCheckoutForm({ ...checkoutForm, observations: e.target.value })} className="mt-1" rows={2} placeholder="Ex: Entregar na portaria" />
                  </div>
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        Custo estimado
                        <button type="button" onClick={() => setShowCostInfo(true)} className="text-slate-400 hover:text-emerald-600 lg:pointer-events-none">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </span>
                      <span className="text-slate-600">{formatBRL(total)}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed lg:text-sm">
                      Para produtos vendidos por peso, o valor será ajustado à quantidade servida. O valor final será cobrado após a separação do seu pedido.
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Frete</span>
                      <span className={shippingFee === 0 ? 'text-emerald-600 font-medium' : 'text-slate-600'}>
                        {shippingFee === 0 ? 'GRATIS' : formatBRL(shippingFee)}
                      </span>
                    </div>
                    {shippingFee > 0 && total < FREE_SHIPPING_THRESHOLD && (
                      <p className="text-xs text-amber-500">Faltam {formatBRL(FREE_SHIPPING_THRESHOLD - total)} para frete gratis!</p>
                    )}
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-500">Total</span>
                      <span className="text-xl font-bold text-emerald-600">{formatBRL(grandTotal)}</span>
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Pedido'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => window.location.reload()} />

      <ProfileEditDialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)} user={user} onSaved={checkUser} />

      <Dialog open={saveListOpen} onOpenChange={setSaveListOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Salvar na lista</DialogTitle></DialogHeader>
          <Label>Nome da lista</Label>
          <Input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} className="mt-1" placeholder="Ex: Compra de sempre" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveListOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmSaveList} disabled={savingList || !newListName.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {savingList ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Tem certeza de que quer esvaziar o seu carrinho?</DialogTitle></DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmClear(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleClearCart} className="flex-1 bg-red-600 hover:bg-red-700">Esvaziar carrinho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCostInfo} onOpenChange={setShowCostInfo}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <Scale className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Custo estimado</h3>
          <p className="text-sm text-slate-500">Para produtos vendidos por peso, o valor cobrado sera ajustado a quantidade servida. O valor final sera cobrado apos a preparacao do seu pedido.</p>
          <Button onClick={() => setShowCostInfo(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2">Entendido</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}