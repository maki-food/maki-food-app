import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44, supabase } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, ClipboardList, UserCog, LogOut, HelpCircle, ShieldCheck, ChevronRight, MapPin, Loader2, Plus, Package, Edit } from 'lucide-react';
import { formatBRL, formatDate, getOrderDisplayItems, getOrderItemQuantityLabel, getOrderItemSubtotal } from '@/lib/format';
import { maskCNPJ, maskPhone } from '@/lib/masks';
import StatusBadge from '@/components/StatusBadge';

const emptyForm = {
  full_name: '',
  personal_phone: '',
  account_name: '',
  restaurant_name: '',
  cnpj: '',
  contact_number: '',
  zip_code: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  address_notes: '',
};

const emptyAddress = {
  id: null,
  zip_code: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  notes: '',
};

export default function Account() {
  const [user, setUser] = useState(undefined);
  const [accountName, setAccountName] = useState(null);
  const [searchParams] = useSearchParams();
  const [selectedSection, setSelectedSection] = useState('orders');
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [extraAddress, setExtraAddress] = useState(null);
  const [orders, setOrders] = useState([]);
  const [productMapById, setProductMapById] = useState({});
  const [productMapByName, setProductMapByName] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showExtraAddress, setShowExtraAddress] = useState(false);
  const [extraForm, setExtraForm] = useState(emptyAddress);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [ordersTab, setOrdersTab] = useState('active');
  const [orderCount, setOrderCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [lookingUpCep2, setLookingUpCep2] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null); // 1 for primary, 2 for extra, null for none
  const [orderNotificationsEnabled, setOrderNotificationsEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [mobileSectionOpen, setMobileSectionOpen] = useState(false);
  const { settings } = useSettings();
  const navigate = useNavigate();

  const loadProfileData = async (currentUser) => {
    const [rests, addrs] = await Promise.all([
      base44.entities.Restaurant.filter({ user_id: currentUser.id }).catch(() => []),
      base44.entities.Address?.filter ? base44.entities.Address.filter({ user_id: currentUser.id }).catch(() => []) : [],
    ]);
    const restaurant = Array.isArray(rests) && rests.length > 0 ? rests[0] : null;
    const allOrders = await base44.entities.Order.list('-created_date', 200).catch(() => []);
    const orders = (allOrders || []).filter(order => (
      order.created_by_id === currentUser.id
      || (restaurant?.restaurant_name && order.restaurant_name === restaurant.restaurant_name)
      || (restaurant?.cnpj && order.restaurant_cnpj === restaurant.cnpj)
    ));

    setOrders(orders);

    const products = await base44.entities.Product.list().catch(() => []);
    setProductMapById(Object.fromEntries((products || []).map(p => [p.id, p])));
    setProductMapByName(Object.fromEntries((products || []).map(p => [String(p.name || '').toLowerCase(), p])));

    if (Array.isArray(rests) && rests.length > 0) {
      const r = rests[0];
      setRestaurant(r);
      setForm({
        full_name: currentUser.full_name || '',
        personal_phone: currentUser.contact_number || '',
        account_name: r.account_name || currentUser.full_name || '',
        restaurant_name: r.restaurant_name || '',
        cnpj: r.cnpj || '',
        contact_number: r.contact_number || '',
        zip_code: r.zip_code || '',
        street: r.street || '',
        number: r.number || '',
        complement: r.complement || '',
        neighborhood: r.neighborhood || '',
        city: r.city || '',
        state: r.state || '',
        address_notes: r.address_notes || '',
      });
    } else {
      setRestaurant(null);
      setForm({
        ...emptyForm,
        full_name: currentUser.full_name || '',
        personal_phone: currentUser.contact_number || '',
        account_name: currentUser.full_name || '',
      });
    }

    if (Array.isArray(addrs) && addrs.length > 0) {
      const a = addrs[0];
      setExtraAddress(a);
      setExtraForm({
        id: a.id,
        zip_code: a.zip_code || '',
        street: a.street || '',
        number: a.number || '',
        complement: a.complement || '',
        neighborhood: a.neighborhood || '',
        city: a.city || '',
        state: a.state || '',
        notes: a.notes || '',
      });
      setShowExtraAddress(true);
    } else {
      setExtraAddress(null);
      setExtraForm(emptyAddress);
      setShowExtraAddress(false);
    }

    setOrderCount(Array.isArray(orders) ? orders.length : 0);
  };

  const load = async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoadingProfile(true);

    const currentUser = await base44.auth.me().catch(() => null);
    setUser(currentUser);
    setOrderNotificationsEnabled(Boolean(currentUser?.order_status_notifications));
    if (!currentUser) {
      setAccountName(null);
      setRestaurant(null);
      setForm(emptyForm);
      setExtraAddress(null);
      setExtraForm(emptyAddress);
      setShowExtraAddress(false);
      setEditingAddress(null);
      if (!silent) setLoadingProfile(false);
      return;
    }

    const rests = await base44.entities.Restaurant.filter({ user_id: currentUser.id }).catch(() => []);
    setAccountName(currentUser.full_name || (Array.isArray(rests) && rests.length > 0 ? rests[0]?.account_name || null : null));
    await loadProfileData(currentUser);
    setEditingAddress(null);
    if (!silent) setLoadingProfile(false);
  };

  useEffect(() => {
    load();

    // Mesma correção do MyOrders.jsx: removido o setInterval de 1s (rodava
    // junto com o realtime, fazendo a mesma busca 2x) e o load() redundante
    // depois do setOrders (o realtime já atualiza o estado com precisão,
    // não precisa buscar tudo de novo por cima).
    const unsub = base44.entities.Order.subscribe((event) => {
      if (event.type === 'refresh' || event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        load({ silent: true });
        return;
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'personal' || section === 'address' || section === 'privacy') {
      setSelectedSection(section);
    } else {
      setSelectedSection('orders');
    }
  }, [searchParams]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    const cartBackup = localStorage.getItem('cart');
    localStorage.clear();
    sessionStorage.clear();
    if (cartBackup) localStorage.setItem('cart', cartBackup);
    window.location.href = '/login';
  };

  const openWhatsApp = () => {
    if (settings?.whatsapp_number) {
      const digits = settings.whatsapp_number.replace(/\D/g, '');
      window.open(`https://wa.me/${digits}`, '_blank');
    } else {
      alert('Nenhum WhatsApp de atendimento configurado ainda.');
    }
  };

  const isIosSafariWebPushUnsupported = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Android/.test(ua);
    return isIOS && isSafari;
  };

  const handleOrderNotificationsToggle = async (nextValue) => {
    if (!user?.id) return;

    const previousValue = orderNotificationsEnabled;

    try {
      if (nextValue) {
        if (isIosSafariWebPushUnsupported()) {
          setOrderNotificationsEnabled(false);
          setUser(prev => ({ ...prev, order_status_notifications: false }));
          return;
        }

        if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          setOrderNotificationsEnabled(false);
          setUser(prev => ({ ...prev, order_status_notifications: false }));
          return;
        }

        if (Notification.permission === 'denied') {
          throw new Error('As notificações foram bloqueadas neste navegador.');
        }

        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            setOrderNotificationsEnabled(false);
            return;
          }
        }

        await navigator.serviceWorker.register('/sw.js').catch(() => null);
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        if (!registration) {
          throw new Error('Serviço de notificações ainda não está pronto. Tente novamente em alguns segundos.');
        }

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BGQAPdL0BRSdzTuEWz5bBAXYGVyxv-aSW75rHywE_VTxLXRBQOBO_HHqf1eOE08Mx3MlBIKlLIH_hBaxPTBgBvk';
        const normalizedKey = vapidKey.replace(/-/g, '+').replace(/_/g, '/');
        const paddedKey = normalizedKey.padEnd(normalizedKey.length + ((4 - normalizedKey.length % 4) % 4), '=');
        const applicationServerKey = Uint8Array.from(atob(paddedKey), char => char.charCodeAt(0));

        let subscription = await registration.pushManager.getSubscription().catch(() => null);
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }).catch((subscribeError) => {
            console.error('Erro ao criar inscrição de push:', subscribeError);
            throw new Error('Não foi possível ativar as notificações neste aparelho.');
          });
        }

        const subscriptionJson = subscription.toJSON();
        const { error } = await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          subscription: subscriptionJson,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' });

        if (error) throw error;
      } else {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        const pushManager = registration && registration.pushManager ? registration.pushManager : null;
        const subscription = pushManager ? await pushManager.getSubscription().catch(() => null) : null;

        if (subscription) {
          await subscription.unsubscribe().catch(() => {});
        }

        const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
        if (error) throw error;
      }

      await base44.entities.User.update(user.id, { order_status_notifications: nextValue });
      setUser(prev => ({ ...prev, order_status_notifications: nextValue }));
      setOrderNotificationsEnabled(nextValue);
    } catch (error) {
      console.error('Erro ao atualizar preferência de notificações:', error);
      setOrderNotificationsEnabled(previousValue);
      setUser(prev => ({ ...prev, order_status_notifications: previousValue }));
      alert(error?.message || 'Não foi possível atualizar a preferência de notificações.');
    }
  };

  const lookupCep = async (digits) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      return data.erro ? null : data;
    } catch {
      return null;
    }
  };

  const handleCepBlur = async () => {
    const digits = (form.zip_code || '').replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    const data = await lookupCep(digits);
    if (data) {
      setForm(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    }
    setLookingUpCep(false);
  };

  const handleCepBlur2 = async () => {
    const digits = (extraForm.zip_code || '').replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep2(true);
    const data = await lookupCep(digits);
    if (data) {
      setExtraForm(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    }
    setLookingUpCep2(false);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      if (selectedSection === 'personal') {
        await base44.entities.User.update(user.id, {
          full_name: form.full_name.trim(),
          contact_number: form.personal_phone,
        });

        const payload = {
          account_name: form.full_name.trim(),
          restaurant_name: form.restaurant_name.trim(),
          cnpj: form.cnpj || null,
          contact_number: form.contact_number,
        };
        if (restaurant) {
          await base44.entities.Restaurant.update(restaurant.id, payload);
        } else {
          await base44.entities.Restaurant.create({ ...payload, user_id: user.id });
        }
      } else if (selectedSection === 'address') {
        const fullAddr = [form.street, form.number, form.complement, form.neighborhood, form.city, form.state, form.zip_code]
          .filter(Boolean)
          .join(', ');
        const payload = {
          account_name: form.account_name,
          restaurant_name: form.restaurant_name,
          cnpj: form.cnpj || null,
          contact_number: form.contact_number,
          street: form.street,
          number: form.number || null,
          complement: form.complement || null,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state,
          zip_code: form.zip_code,
          address_notes: form.address_notes || null,
          address: fullAddr,
        };
        if (restaurant) {
          await base44.entities.Restaurant.update(restaurant.id, payload);
        } else {
          await base44.entities.Restaurant.create({ ...payload, user_id: user.id });
        }

        if (showExtraAddress && extraForm.street) {
          const extraFullAddr = [extraForm.street, extraForm.number, extraForm.complement, extraForm.neighborhood, extraForm.city, extraForm.state, extraForm.zip_code]
            .filter(Boolean)
            .join(', ');
          const extraPayload = {
            zip_code: extraForm.zip_code,
            street: extraForm.street,
            number: extraForm.number || null,
            complement: extraForm.complement || null,
            neighborhood: extraForm.neighborhood,
            city: extraForm.city,
            state: extraForm.state,
            notes: extraForm.notes || null,
          };
          if (extraAddress) {
            await base44.entities.Address.update(extraAddress.id, extraPayload);
            // Don't update extraAddress here - let load() refresh it
          } else {
            const newAddress = await base44.entities.Address.create({ ...extraPayload, user_id: user.id, label: 'Endereço 2' });
            // Don't update extraAddress here - let load() refresh it
          }
        } else if (!showExtraAddress && extraAddress) {
          await base44.entities.Address.delete(extraAddress.id);
        }
      }
    } catch (err) {
      console.error('Error saving:', err);
      // Optionally show error to user
    } finally {
      // Always reset editing state and stop showing spinner
      setEditingAddress(null);
      setSaving(false);
    }

    // Reload data to ensure we have the latest
    try {
      await load();
    } catch (err) {
      console.error('Error reloading data:', err);
      // We could show an error here, but for now just log it
    }
  };

  const renderSection = () => {
    if (loadingProfile) {
      return (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      );
    }

    if (selectedSection === 'personal') {
      return (
        <form className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1" placeholder="Seu Nome" />
          </div>
          <div>
            <Label>E-mail cadastrado</Label>
            <Input disabled value={user.email || ''} className="mt-1 bg-slate-100 cursor-not-allowed" />
          </div>
          <div>
            <Label>Telefone pessoal</Label>
            <Input value={form.personal_phone} onChange={e => setForm({ ...form, personal_phone: maskPhone(e.target.value) })} className="mt-1" placeholder="(11) 99999-9999" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">Notificações do status do pedido</p>
                <p className="text-xs text-slate-500">Receba alertas quando o seu pedido mudar de etapa.</p>
              </div>
              <button
                type="button"
                onClick={() => handleOrderNotificationsToggle(!orderNotificationsEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${orderNotificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                aria-label="Alternar notificações"
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${orderNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900">Meus restaurantes cadastrados</h3>
              <p className="text-sm text-slate-500 mt-1">Atualize os dados usados nos seus pedidos.</p>
            </div>
            <div>
              <Label>Nome do restaurante (opcional)</Label>
              <Input value={form.restaurant_name} onChange={e => setForm({ ...form, restaurant_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>CNPJ (opcional)</Label>
              <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} className="mt-1" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Telefone do restaurante (opcional)</Label>
              <Input value={form.contact_number} onChange={e => setForm({ ...form, contact_number: maskPhone(e.target.value) })} className="mt-1" placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => load()} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </form>
      );
    }

    if (selectedSection === 'address') {
      return (
        <>
          {/* Display saved addresses in clear cards */}
          <div className="space-y-6">

            {/* Primary Address Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />Endereço 1 (Principal)
                </h3>
                <Button variant="outline" size="icon" onClick={() => {
                    if (restaurant) {
                      setForm({
                        account_name: restaurant.account_name || '',
                        restaurant_name: restaurant.restaurant_name || '',
                        cnpj: restaurant.cnpj || '',
                        contact_number: restaurant.contact_number || '',
                        zip_code: restaurant.zip_code || '',
                        street: restaurant.street || '',
                        number: restaurant.number || '',
                        complement: restaurant.complement || '',
                        neighborhood: restaurant.neighborhood || '',
                        city: restaurant.city || '',
                        state: restaurant.state || '',
                        address_notes: restaurant.address_notes || '',
                      });
                    } else {
                      setForm(emptyForm);
                    }
                    setEditingAddress(1);
                  }}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>

              {restaurant ? (
                <>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500"><strong>Rua:</strong> {restaurant.street || 'Não informado'}</p>
                    {restaurant.number && (
                      <p className="text-sm text-slate-500"><strong>Número:</strong> {restaurant.number}</p>
                    )}
                    {restaurant.complement && (
                      <p className="text-sm text-slate-500"><strong>Complemento:</strong> {restaurant.complement}</p>
                    )}
                    <p className="text-sm text-slate-500"><strong>Bairro:</strong> {restaurant.neighborhood || 'Não informado'}</p>
                    <p className="text-sm text-slate-500"><strong>Cidade:</strong> {restaurant.city || 'Não informado'}</p>
                    <p className="text-sm text-slate-500"><strong>Estado:</strong> {restaurant.state || 'Não informado'}</p>
                    <p className="text-sm text-slate-500"><strong>CEP:</strong> {restaurant.zip_code || 'Não informado'}</p>
                  </div>

                  {restaurant.address_notes && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-sm text-slate-500 font-medium mb-1">Observações:</p>
                      <p className="text-sm text-slate-400">{restaurant.address_notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Nenhum endereço principal cadastrado</p>
                  <Button variant="outline" size="icon" onClick={() => {
                    setForm(emptyForm);
                    setEditingAddress(1);
                  }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Extra Address Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />Endereço 2 (Opcional)
                </h3>
                {extraAddress ? (
                  <Button onClick={() => {
                    if (extraAddress) {
                      setExtraForm({
                        id: extraAddress.id,
                        zip_code: extraAddress.zip_code || '',
                        street: extraAddress.street || '',
                        number: extraAddress.number || '',
                        complement: extraAddress.complement || '',
                        neighborhood: extraAddress.neighborhood || '',
                        city: extraAddress.city || '',
                        state: extraAddress.state || '',
                        notes: extraAddress.notes || '',
                      });
                    } else {
                      setExtraForm(emptyAddress);
                    }
                    setEditingAddress(2);
                  }} variant="outline" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon" onClick={() => {
                    setExtraForm(emptyAddress);
                    setEditingAddress(2);
                    setShowExtraAddress(true);
                  }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {extraAddress ? (
                <>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500"><strong>Rua:</strong> {extraAddress.street || 'Não informado'}</p>
                    {extraAddress.number && (
                      <p className="text-sm text-slate-500"><strong>Número:</strong> {extraAddress.number}</p>
                    )}
                    {extraAddress.complement && (
                      <p className="text-sm text-slate-500"><strong>Complemento:</strong> {extraAddress.complement}</p>
                    )}
                    <p className="text-sm text-slate-500"><strong>Bairro:</strong> {extraAddress.neighborhood || 'Não informado'}</p>
                    <p className="text-sm text-slate-500"><strong>Cidade:</strong> {extraAddress.city || 'Não informado'}</p>
                    <p className="text-sm text-slate-500"><strong>Estado:</strong> {extraAddress.state || 'Não informado'}</p>
                    <p className="text-sm text-slate-500"><strong>CEP:</strong> {extraAddress.zip_code || 'Não informado'}</p>
                  </div>

                  {extraAddress.notes && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-sm text-slate-500 font-medium mb-1">Observações:</p>
                      <p className="text-sm text-slate-400">{extraAddress.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Nenhum endereço adicional cadastrado</p>
                  <Button
                    onClick={() => {
                      setExtraForm(emptyAddress);
                      setEditingAddress(2);
                    }}
                    className="w-full mt-2 text-left bg-emerald-50 hover:bg-emerald-100"
                  >
                    Adicionar Endereço 2
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Edit Forms */}
          {editingAddress === 1 && (
            <form className="mt-6 space-y-4">
              <div className="pt-3 border-t border-slate-100">
                <Label>Endereço 1 (principal) *</Label>
                <div className="relative mt-1">
                  <Input required value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} onBlur={handleCepBlur} placeholder="CEP: 00000-000" />
                  {lookingUpCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-slate-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">Digite o CEP para preencher o endereço automaticamente.</p>
              </div>
              <Input required value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} placeholder="Rua / Avenida" />
              <div className="grid grid-cols-2 gap-2">
                <Input required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Número" />
                <Input value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} placeholder="Complemento" />
              </div>
              <Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} placeholder="Bairro" />
              <div className="grid grid-cols-2 gap-2">
                <Input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Cidade" />
                <Input required value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" />
              </div>
              <div>
                <Label>Observações do Endereço 1 (opcional)</Label>
                <Textarea value={form.address_notes} onChange={e => setForm({ ...form, address_notes: e.target.value })} className="mt-1" rows={2} placeholder="Ex: portão azul, tocar interfone 2" />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAddress(null)} className="w-full sm:w-auto">Cancelar</Button>
                <Button type="submit" disabled={saving} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </form>
          )}
          {editingAddress === 2 && (
            <form className="mt-6 space-y-4">
              <div className="pt-3 border-t border-slate-100">
                <Label>Endereço 2 (opcional)</Label>
                <div className="relative mt-1">
                  <Input value={extraForm.zip_code} onChange={e => setExtraForm({ ...extraForm, zip_code: e.target.value })} onBlur={handleCepBlur2} placeholder="CEP: 00000-000" />
                  {lookingUpCep2 && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-slate-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">Digite o CEP para preencher o endereço automaticamente.</p>
              </div>
              <Input value={extraForm.street} onChange={e => setExtraForm({ ...extraForm, street: e.target.value })} placeholder="Rua / Avenida" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={extraForm.number} onChange={e => setExtraForm({ ...extraForm, number: e.target.value })} placeholder="Número" />
                <Input value={extraForm.complement} onChange={e => setExtraForm({ ...extraForm, complement: e.target.value })} placeholder="Complemento" />
              </div>
              <Input value={extraForm.neighborhood} onChange={e => setExtraForm({ ...extraForm, neighborhood: e.target.value })} placeholder="Bairro" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={extraForm.city} onChange={e => setExtraForm({ ...extraForm, city: e.target.value })} placeholder="Cidade" />
                <Input value={extraForm.state} onChange={e => setExtraForm({ ...extraForm, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" />
              </div>
              <Textarea value={extraForm.notes} onChange={e => setExtraForm({ ...extraForm, notes: e.target.value })} rows={2} placeholder="Observações do Endereço 2 (opcional)" />

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAddress(null)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </form>
          )}
        </>
      );
    }

    if (selectedSection === 'privacy') {
      return (
        <div className="space-y-4 text-sm text-slate-600">
          <p>Seus dados (nome, endereço, telefone e histórico de pedidos) são usados só para processar suas compras e melhorar seu atendimento.</p>
          <p>Não vendemos nem compartilhamos suas informações com terceiros fora do necessário para a entrega do seu pedido.</p>
          <p>Para dúvidas ou para pedir a exclusão dos seus dados, entre em contato pelo WhatsApp de atendimento.</p>
        </div>
      );
    }

    const activeOrders = orders.filter(o => o.status !== 'Finalizado');
    const finalizedOrders = orders.filter(o => o.status === 'Finalizado');
    const sortByDeliverySequence = (a, b) => {
      if (a.delivery_sequence == null && b.delivery_sequence == null) {
        return new Date(b.created_date) - new Date(a.created_date);
      }
      if (a.delivery_sequence == null) return 1;
      if (b.delivery_sequence == null) return -1;
      return Number(a.delivery_sequence) - Number(b.delivery_sequence);
    };
    const visibleOrders = (ordersTab === 'active' ? activeOrders : finalizedOrders).sort(ordersTab === 'active' ? sortByDeliverySequence : (a, b) => new Date(b.created_date) - new Date(a.created_date));

    const renderOrderCard = (order) => {
      const isExpanded = expandedOrderId === order.id;
      return (
        <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-3">
          <button
            type="button"
            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
            className="w-full p-4 text-left hover:bg-slate-50 transition"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 truncate">{order.invoice_number || `Pedido #${order.id?.slice(-6).toUpperCase()}`}</p>
                  <p className="text-sm text-slate-500">{formatDate(order.created_date)} • {(order.items || []).length} itens</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={order.status} />
                <span className="text-sm font-semibold text-slate-900">{formatBRL(order.total)}</span>
              </div>
            </div>
          </button>
          {isExpanded ? (
            <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4 text-sm text-slate-600">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Endereço</p>
                  <p className="text-slate-700">{order.delivery_address || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Pagamento</p>
                  <p className="text-slate-700">{order.payment_method_2 ? `${order.payment_method} + ${order.payment_method_2}` : (order.payment_method || 'Não informado')}</p>
                </div>
              </div>

              {(order.items || []).length > 0 ? (
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2 text-center">Qtd</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getOrderDisplayItems(order).map((item, index) => (
                        <tr key={`${item.product_id || index}-${item.variant_id || 'default'}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">{item.product_name}{item.variant_name ? ` - ${item.variant_name}` : ''}</td>
                          <td className="px-3 py-2 text-center">{getOrderItemQuantityLabel(item)}</td>
                          <td className="px-3 py-2 text-right">{formatBRL(getOrderItemSubtotal(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500">Produtos não disponíveis</div>
              )}

              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>Frete</span>
                <span>{(order.shipping_fee || 0) > 0 ? formatBRL(order.shipping_fee) : 'Grátis'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-lg font-bold text-emerald-600">{formatBRL(order.total)}</span>
              </div>
            </div>
          ) : null}
        </div>
      );
    };

    return (
      <div className="space-y-6 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setOrdersTab('active');
                setExpandedOrderId(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${ordersTab === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Pedidos em andamento
            </button>
            <button
              type="button"
              onClick={() => {
                setOrdersTab('finalized');
                setExpandedOrderId(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${ordersTab === 'finalized' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Pedidos concluídos
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {ordersTab === 'active'
              ? `${activeOrders.length} pedido(s) em andamento`
              : `${finalizedOrders.length} pedido(s) concluído(s)`}
          </p>
        </div>

        {visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
            {ordersTab === 'active' ? 'Nenhum pedido em andamento no momento.' : 'Ainda não há pedidos concluídos.'}
          </div>
        ) : (
          visibleOrders.map(renderOrderCard)
        )}
      </div>
    );
  };

  const sections = [
    { id: 'orders', label: 'Meus pedidos', icon: ClipboardList },
    { id: 'personal', label: 'Dados pessoais', icon: UserCog },
    { id: 'address', label: 'Endereços', icon: MapPin },
  ];

  if (user === undefined) {
    return (
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-20 rounded-3xl bg-slate-100 animate-pulse" />
          <div className="mt-6 space-y-3">
            <div className="h-4 w-28 bg-slate-100 rounded-full animate-pulse" />
            <div className="h-4 w-20 bg-slate-100 rounded-full animate-pulse" />
          </div>
        </aside>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-48 bg-slate-100 rounded-full animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
            <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
          </div>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Convidado</h1>
        <p className="text-sm text-slate-400 mb-8">Entre pra acompanhar seus pedidos e endereços</p>

        <div className="bg-slate-50 rounded-2xl p-6 text-center mb-6">
          <p className="text-sm text-slate-600 mb-4">
            Para comprar, você precisa de uma conta, para que possa fazer as suas compras em menos tempo e também possamos fornecer um serviço melhor.
          </p>
          <Link to="/login">
            <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-semibold">Entrar</Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          <button onClick={openWhatsApp} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
            <HelpCircle className="w-5 h-5 text-slate-400" />
            <span className="flex-1 font-medium text-slate-700">Ajuda</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  const showSectionList = !isMobile || !mobileSectionOpen;

  const mobileSelectSection = (sectionId) => {
    setSelectedSection(sectionId);
    setMobileSectionOpen(true);
  };

  const renderAccountMobileNav = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <User className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 truncate">{accountName || user.full_name || 'Minha Conta'}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => mobileSelectSection(section.id)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{section.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        );
      })}

      <button onClick={() => mobileSelectSection('privacy')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Privacidade e dados</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </button>
    </div>
  );

  const renderAccountDetail = () => (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileSectionOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label="Voltar para a conta"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {selectedSection === 'orders'
              ? 'Meus pedidos'
              : selectedSection === 'personal'
                ? 'Dados pessoais'
                : selectedSection === 'address'
                  ? 'Endereços'
                  : 'Privacidade e dados'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {selectedSection === 'orders'
              ? 'Aqui você pode ver uma lista dos pedidos que fez e o status de cada compra.'
              : selectedSection === 'personal'
                ? 'Atualize seu nome e telefone de contato.'
                : selectedSection === 'address'
                  ? 'Atualize os dados de endereço e o nome do restaurante.'
                  : 'Informações sobre como seus dados são usados e protegidos.'}
          </p>
        </div>
      </div>

      <div className="mt-6">{renderSection()}</div>
    </section>
  );

  if (isMobile) {
    return (
      <div className="space-y-4">
        {!showSectionList ? renderAccountDetail() : renderAccountMobileNav()}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
      <aside className="w-[260px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm self-start">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <User className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 truncate">{accountName || user.full_name || 'Minha Conta'}</p>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
          </div>
        </div>

        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = section.id === selectedSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSection(section.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${active ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 pt-6 border-t border-slate-100 space-y-2">
          <button onClick={() => setSelectedSection('privacy')} className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${selectedSection === 'privacy' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <ShieldCheck className="w-4 h-4 inline-block mr-2" /> Privacidade e dados
          </button>
          <button onClick={openWhatsApp} className="w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50">
            <HelpCircle className="w-4 h-4 inline-block mr-2" /> Ajuda
          </button>
          <button onClick={handleLogout} className="w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4 inline-block mr-2" /> Sair
          </button>
        </div>
      </aside>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {selectedSection === 'orders' && orderCount === 0 ? null : (
              <>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {selectedSection === 'orders'
                    ? 'Meus pedidos'
                    : selectedSection === 'personal'
                      ? 'Dados pessoais'
                      : selectedSection === 'address'
                        ? 'Endereços'
                        : 'Privacidade e dados'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedSection === 'orders'
                    ? 'Aqui você pode ver uma lista dos pedidos que fez e o status de cada compra.'
                    : selectedSection === 'personal'
                      ? 'Atualize seu nome e telefone de contato.'
                      : selectedSection === 'address'
                        ? 'Atualize os dados de endereço e o nome do restaurante.'
                        : 'Informações sobre como seus dados são usados e protegidos.'}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-6">
          {renderSection()}
        </div>
      </section>
    </div>
  );
}
