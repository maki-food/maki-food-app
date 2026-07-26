import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { formatBRL } from '@/lib/format';
import { maskPhone, maskCEP, maskCNPJ } from '@/lib/masks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AuthModal from '@/components/AuthModal';
import ProfileEditDialog from '@/components/client/ProfileEditDialog';
import QuantitySelector from '@/components/QuantitySelector';
import { Trash2, ShoppingBag, Loader2, CheckCircle, Store, MapPin, CreditCard, Package, Truck, X, MoreVertical, Info, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

export default function Cart() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();
  const { settings } = useSettings();
  const paymentMethods = settings?.payment_methods || ['Pix', 'Dinheiro'];
  const SHIPPING_FEE = settings?.shipping_fee ?? 20;
  const FREE_SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 200;
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profileForm, setProfileForm] = useState({
    restaurant_name: '', cnpj: '', contact_number: '',
    street: '', neighborhood: '', city: '', state: '', zip_code: '',
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

  const shippingFee = total >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const grandTotal = total + shippingFee;

  const checkUser = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const restaurants = await base44.entities.Restaurant.filter({ user_id: u.id });
      if (restaurants.length > 0) {
        const r = restaurants[0];
        setRestaurant(r);
        setProfileForm({
          restaurant_name: r.restaurant_name || '', cnpj: r.cnpj || '', contact_number: r.contact_number || '',
          street: r.street || '', neighborhood: r.neighborhood || '', city: r.city || '', state: r.state || '', zip_code: r.zip_code || '',
        });
        const fullAddr = [r.street, r.neighborhood, r.city, r.state, r.zip_code].filter(Boolean).join(', ');
        setCheckoutForm(prev => ({ ...prev, delivery_address: fullAddr || r.address || '' }));
      }
      const extraAddrs = await base44.entities.Address.filter({ user_id: u.id }).catch(() => []);
      setAddresses(extraAddrs || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { checkUser(); }, []);

  const buildFullAddress = (f) => [f.street, f.neighborhood, f.city, f.state, f.zip_code].filter(Boolean).join(', ');

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
    setSubmitting(true);
    try {
      const orderItems = items.map(i => ({
        product_name: i.product_name || i.name, quantity: i.quantity, barcode: i.barcode || '', price: i.price,
        variant_id: i.variant_id || null, variant_name: i.variant_name || null, weight_kg: i.weight_kg || null,
      }));
      const invoiceNumber = await generateInvoiceNumber();
      await base44.entities.Order.create({
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
      await logAction('Pedido Criado', `${restaurant.restaurant_name} - ${formatBRL(grandTotal)}`);
      clearCart();
      setSuccess(true);
      setTimeout(() => navigate('/loja/pedidos'), 2500);
    } catch {}
    setSubmitting(false);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => (
            <div key={item.product_id + (item.variant_id || '')} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-slate-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{item.name}</p>
                <p className="text-sm text-slate-500">{formatBRL(item.price)}{item.variant_name ? ` / ${item.variant_name}` : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <QuantitySelector value={item.quantity} onChange={v => updateQuantity(item.product_id, v, item.variant_id)} min={(item.unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(item.unit)) ? 0.1 : 1} max={item.stock_quantity} step={(item.unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(item.unit)) ? 0.5 : 1} size="sm" />
                <button onClick={() => removeItem(item.product_id, item.variant_id)} className="p-2 text-slate-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="font-semibold text-slate-900 w-20 text-right hidden sm:block">{formatBRL(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          {!user ? (
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
                {addresses.length > 0 && (
                  <div>
                    <Label><MapPin className="w-3.5 h-3.5 inline mr-1" />Qual endereço?</Label>
                    <Select
                      value={checkoutForm.delivery_address}
                      onValueChange={v => setCheckoutForm({ ...checkoutForm, delivery_address: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o endereço" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={[restaurant.street, restaurant.neighborhood, restaurant.city, restaurant.state, restaurant.zip_code].filter(Boolean).join(', ') || restaurant.address}>
                          Endereço 1 — {restaurant.street || restaurant.address}
                        </SelectItem>
                        {addresses.map(a => (
                          <SelectItem key={a.id} value={[a.street, a.neighborhood, a.city, a.state, a.zip_code].filter(Boolean).join(', ')}>
                            {a.label || 'Endereço 2'} — {a.street}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label><MapPin className="w-3.5 h-3.5 inline mr-1" />Endereço de Entrega *</Label>
                  <Textarea required value={checkoutForm.delivery_address} onChange={e => setCheckoutForm({ ...checkoutForm, delivery_address: e.target.value })} className="mt-1" rows={2} />
                </div>
                <div>
                  <Label><CreditCard className="w-3.5 h-3.5 inline mr-1" />Forma de Pagamento *</Label>
                  <Select value={checkoutForm.payment_method} onValueChange={v => setCheckoutForm({ ...checkoutForm, payment_method: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea value={checkoutForm.observations} onChange={e => setCheckoutForm({ ...checkoutForm, observations: e.target.value })} className="mt-1" rows={2} placeholder="Ex: Entregar na portaria" />
                </div>
                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-slate-500 flex items-center gap-1">
                      Custo estimado
                      <button type="button" onClick={() => setShowCostInfo(true)} className="text-slate-400 hover:text-emerald-600">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </span>
                    <span className="text-slate-600">{formatBRL(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Frete</span>
                    <span className={shippingFee === 0 ? 'text-emerald-600 font-medium' : 'text-slate-600'}>
                      {shippingFee === 0 ? 'GRÁTIS' : formatBRL(shippingFee)}
                    </span>
                  </div>
                  {shippingFee > 0 && total < FREE_SHIPPING_THRESHOLD && (
                    <p className="text-xs text-amber-500">Faltam {formatBRL(FREE_SHIPPING_THRESHOLD - total)} para frete grátis!</p>
                  )}
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Total</span>
                    <span className="text-xl font-bold text-emerald-600">{formatBRL(grandTotal)}</span>
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confira'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => window.location.reload()}
      />

      <ProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        user={user}
        onSaved={checkUser}
      />

      <Dialog open={saveListOpen} onOpenChange={setSaveListOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar na lista</DialogTitle>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Tem certeza de que quer esvaziar o seu carrinho?</DialogTitle>
          </DialogHeader>
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
          <p className="text-sm text-slate-500">
            Para produtos vendidos por peso, o valor cobrado será ajustado à quantidade servida. O valor final será cobrado após a preparação do seu pedido.
          </p>
          <Button onClick={() => setShowCostInfo(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}