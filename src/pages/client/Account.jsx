import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, ClipboardList, UserCog, LogOut, HelpCircle, ShieldCheck, ChevronRight, MapPin, Loader2, Plus, Trash2, Package } from 'lucide-react';

const emptyForm = {
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
  const [selectedSection, setSelectedSection] = useState('orders');
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [extraAddress, setExtraAddress] = useState(null);
  const [showExtraAddress, setShowExtraAddress] = useState(false);
  const [extraForm, setExtraForm] = useState(emptyAddress);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [orderCount, setOrderCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [lookingUpCep2, setLookingUpCep2] = useState(false);
  const { settings } = useSettings();
  const navigate = useNavigate();

  const loadProfileData = async (currentUser) => {
    const [rests, addrs, orders] = await Promise.all([
      base44.entities.Restaurant.filter({ user_id: currentUser.id }).catch(() => []),
      base44.entities.Address?.filter ? base44.entities.Address.filter({ user_id: currentUser.id }).catch(() => []) : [],
      base44.entities.Order?.filter ? base44.entities.Order.filter({ user_id: currentUser.id }).catch(() => []) : [],
    ]);

    if (Array.isArray(rests) && rests.length > 0) {
      const r = rests[0];
      setRestaurant(r);
      setForm({
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
      setForm({ ...emptyForm, account_name: currentUser.full_name || '' });
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

  const load = async () => {
    setLoadingProfile(true);
    const currentUser = await base44.auth.me().catch(() => null);
    setUser(currentUser);
    if (!currentUser) {
      setAccountName(null);
      setRestaurant(null);
      setForm(emptyForm);
      setExtraAddress(null);
      setExtraForm(emptyAddress);
      setShowExtraAddress(false);
      setLoadingProfile(false);
      return;
    }

    const rests = await base44.entities.Restaurant.filter({ user_id: currentUser.id }).catch(() => []);
    setAccountName(Array.isArray(rests) && rests.length > 0 ? rests[0]?.account_name || null : null);
    await loadProfileData(currentUser);
    setLoadingProfile(false);
  };

  useEffect(() => {
    load();
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
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    }
    setLookingUpCep2(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (selectedSection === 'personal') {
        const payload = {
          account_name: form.account_name,
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
          } else {
            await base44.entities.Address.create({ ...extraPayload, user_id: user.id, label: 'Endereço 2' });
          }
        } else if (!showExtraAddress && extraAddress) {
          await base44.entities.Address.delete(extraAddress.id);
        }
      }

      await load();
    } catch {
      // ignore
    }

    setSaving(false);
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
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>E-mail</Label>
            <Input disabled value={user.email || ''} className="mt-1 bg-slate-100 cursor-not-allowed" />
          </div>
          <div>
            <Label>Nome completo *</Label>
            <Input required value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Número de contato *</Label>
            <Input required value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} className="mt-1" placeholder="(11) 99999-9999" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => load()} className="w-full sm:w-auto">Cancelar</Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </form>
      );
    }

    if (selectedSection === 'orders') {
      return (
        <div className="space-y-6 pt-6">
          {orderCount > 0 ? (
            <>
              <p className="text-sm text-slate-600">Aqui você pode ver uma lista dos pedidos que fez e o status de cada compra.</p>
              <div className="flex justify-center pt-3">
                <Button onClick={() => navigate('/loja/pedidos')} className="bg-emerald-600 hover:bg-emerald-700">
                  Ver meus pedidos
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 pt-6">
              <Package className="h-20 w-20 text-slate-400" />
              <div className="space-y-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">Você ainda não fez seu primeiro pedido.</p>
                <p className="text-sm text-slate-600">Aqui você pode ver uma lista dos pedidos que fez e o status de cada compra.</p>
              </div>
              <Button onClick={() => navigate('/loja/produtos')} className="bg-emerald-600 hover:bg-emerald-700">
                Inicie sua compra
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (selectedSection === 'address') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Nome do Restaurante *</Label>
            <Input required value={form.restaurant_name} onChange={e => setForm({ ...form, restaurant_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>CNPJ (opcional)</Label>
            <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} className="mt-1" placeholder="00.000.000/0000-00" />
          </div>
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

          {showExtraAddress ? (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Endereço 2 (opcional)</Label>
                <button type="button" onClick={() => { setShowExtraAddress(false); setExtraForm(emptyAddress); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
              <div className="relative">
                <Input value={extraForm.zip_code} onChange={e => setExtraForm({ ...extraForm, zip_code: e.target.value })} onBlur={handleCepBlur2} placeholder="CEP: 00000-000" />
                {lookingUpCep2 && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-slate-400" />}
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
            </div>
          ) : (
            <button type="button" onClick={() => setShowExtraAddress(true)} className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700 pt-2 border-t border-slate-100 w-full">
              <Plus className="w-4 h-4" /> Adicionar outro endereço (opcional, máx. 2)
            </button>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => load()} className="w-full sm:w-auto">Cancelar</Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </form>
      );
    }

    return (
      <div className="space-y-4 text-sm text-slate-600">
        <p>Seus dados (nome, endereço, telefone e histórico de pedidos) são usados só para processar suas compras e melhorar seu atendimento.</p>
        <p>Não vendemos nem compartilhamos suas informações com terceiros fora do necessário para a entrega do seu pedido.</p>
        <p>Para dúvidas ou para pedir a exclusão dos seus dados, entre em contato pelo WhatsApp de atendimento.</p>
      </div>
    );
  };

  const sections = [
    { id: 'orders', label: 'Meus pedidos', icon: ClipboardList },
    { id: 'personal', label: 'Dados pessoais', icon: UserCog },
    { id: 'address', label: 'Endereços', icon: MapPin },
  ];

  if (user === undefined) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
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

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
