import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { maskPhone, maskCNPJ, maskCEP } from '@/lib/masks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const emptyForm = {
  account_name: '', restaurant_name: '', cnpj: '', contact_number: '',
  zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', address_notes: '',
};

const emptyAddress = { id: null, zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', notes: '' };

export default function ProfileEditDialog({ open, onClose, user, onSaved }) {
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [extraAddress, setExtraAddress] = useState(null); // registro salvo, se houver
  const [showExtraAddress, setShowExtraAddress] = useState(false);
  const [extraForm, setExtraForm] = useState(emptyAddress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [lookingUpCep2, setLookingUpCep2] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      Promise.all([
        base44.entities.Restaurant.filter({ user_id: user.id }),
        base44.entities.Address?.filter ? base44.entities.Address.filter({ user_id: user.id }) : Promise.resolve([]),
      ])
        .then(([rests, addrs]) => {
          if (rests.length > 0) {
            const r = rests[0];
            setRestaurant(r);
            setForm({
              account_name: r.account_name || '', restaurant_name: r.restaurant_name || '',
              cnpj: r.cnpj || '', contact_number: r.contact_number || '', zip_code: r.zip_code || '', street: r.street || '',
              number: r.number || '', complement: r.complement || '',
              neighborhood: r.neighborhood || '', city: r.city || '', state: r.state || '', address_notes: r.address_notes || '',
            });
          } else {
            setRestaurant(null);
            setForm(emptyForm);
          }
          if (addrs && addrs.length > 0) {
            const a = addrs[0];
            setExtraAddress(a);
            setExtraForm({ id: a.id, zip_code: a.zip_code || '', street: a.street || '', number: a.number || '', complement: a.complement || '', neighborhood: a.neighborhood || '', city: a.city || '', state: a.state || '', notes: a.notes || '' });
            setShowExtraAddress(true);
          } else {
            setExtraAddress(null);
            setExtraForm(emptyAddress);
            setShowExtraAddress(false);
          }
        })
        .catch(() => { setRestaurant(null); setForm(emptyForm); })
        .finally(() => setLoading(false));
    }
  }, [open, user]);

  const lookupCep = async (digits) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      return data.erro ? null : data;
    } catch { return null; }
  };

  const handleCepBlur = async () => {
    const digits = (form.zip_code || '').replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    const data = await lookupCep(digits);
    if (data) {
      setForm(prev => ({ ...prev, street: data.logradouro || prev.street, complement: data.complemento || prev.complement, neighborhood: data.bairro || prev.neighborhood, city: data.localidade || prev.city, state: data.uf || prev.state }));
    }
    setLookingUpCep(false);
  };

  const handleCepBlur2 = async () => {
    const digits = (extraForm.zip_code || '').replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep2(true);
    const data = await lookupCep(digits);
    if (data) {
      setExtraForm(prev => ({ ...prev, street: data.logradouro || prev.street, complement: data.complemento || prev.complement, neighborhood: data.bairro || prev.neighborhood, city: data.localidade || prev.city, state: data.uf || prev.state }));
    }
    setLookingUpCep2(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fullAddr = [form.street, form.number, form.complement, form.neighborhood, form.city, form.state, form.zip_code]
        .filter(Boolean)
        .join(', ');
      const payload = {
        account_name: form.account_name, restaurant_name: form.restaurant_name, cnpj: form.cnpj || null,
        contact_number: form.contact_number, street: form.street, number: form.number || null, complement: form.complement || null,
        neighborhood: form.neighborhood, city: form.city, state: form.state, zip_code: form.zip_code, address_notes: form.address_notes || null,
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
          zip_code: extraForm.zip_code, street: extraForm.street, number: extraForm.number || null, complement: extraForm.complement || null,
          neighborhood: extraForm.neighborhood, city: extraForm.city, state: extraForm.state, notes: extraForm.notes || null,
        };
        if (extraAddress) {
          await base44.entities.Address.update(extraAddress.id, { ...extraPayload, address: extraFullAddr });
        } else {
          await base44.entities.Address.create({ ...extraPayload, user_id: user.id, label: 'Endereço 2', address: extraFullAddr });
        }
      } else if (!showExtraAddress && extraAddress) {
        await base44.entities.Address.delete(extraAddress.id);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar perfil', description: err.message || 'Tente novamente.' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{restaurant ? 'Editar Perfil' : 'Complete seu Cadastro'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input required value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Nome do Restaurante *</Label>
              <Input required value={form.restaurant_name} onChange={e => setForm({ ...form, restaurant_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>CNPJ (opcional)</Label>
              <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} className="mt-1" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Número de Contato *</Label>
              <Input required value={form.contact_number} onChange={e => setForm({ ...form, contact_number: maskPhone(e.target.value) })} className="mt-1" placeholder="(11) 99999-9999" />
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Label>Endereço 1 (principal) *</Label>
              <div className="relative mt-1">
                <Input required value={form.zip_code} onChange={e => setForm({ ...form, zip_code: maskCEP(e.target.value) })} onBlur={handleCepBlur} placeholder="CEP: 00000-000" />
                {lookingUpCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-slate-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1">Digita o CEP que a gente preenche o resto sozinho.</p>
            </div>
            <Input required value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} placeholder="Rua / Avenida" />
            <div className="grid grid-cols-2 gap-2">
              <Input required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Número" className="mt-1" />
              <Input value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} placeholder="Complemento" className="mt-1" />
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
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Endereço 2 (opcional)</Label>
                  <button type="button" onClick={() => { setShowExtraAddress(false); setExtraForm(emptyAddress); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                </div>
                <div className="relative">
                  <Input value={extraForm.zip_code} onChange={e => setExtraForm({ ...extraForm, zip_code: maskCEP(e.target.value) })} onBlur={handleCepBlur2} placeholder="CEP: 00000-000" />
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

            <DialogFooter>
              {restaurant && <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>}
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
