import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { maskPhone, maskCNPJ, maskCEP } from '@/lib/masks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const emptyForm = {
  account_name: '', restaurant_name: '', cnpj: '', contact_number: '',
  zip_code: '', street: '', neighborhood: '', city: '', state: '', address_notes: '',
};

export default function ProfileEditDialog({ open, onClose, user, onSaved }) {
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      base44.entities.Restaurant.filter({ user_id: user.id })
        .then(rests => {
          if (rests.length > 0) {
            const r = rests[0];
            setRestaurant(r);
            setForm({
              account_name: r.account_name || '', restaurant_name: r.restaurant_name || '', cnpj: r.cnpj || '',
              contact_number: r.contact_number || '', zip_code: r.zip_code || '', street: r.street || '',
              neighborhood: r.neighborhood || '', city: r.city || '', state: r.state || '', address_notes: r.address_notes || '',
            });
          } else {
            setRestaurant(null);
            setForm(emptyForm);
          }
        })
        .catch(() => { setRestaurant(null); setForm(emptyForm); })
        .finally(() => setLoading(false));
    }
  }, [open, user]);

  const handleCepBlur = async () => {
    const digits = (form.zip_code || '').replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {}
    setLookingUpCep(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fullAddr = [form.street, form.neighborhood, form.city, form.state, form.zip_code].filter(Boolean).join(', ');
      const payload = {
        account_name: form.account_name, restaurant_name: form.restaurant_name, cnpj: form.cnpj || null,
        contact_number: form.contact_number, street: form.street, neighborhood: form.neighborhood,
        city: form.city, state: form.state, zip_code: form.zip_code, address_notes: form.address_notes || null,
        address: fullAddr,
      };
      if (restaurant) {
        await base44.entities.Restaurant.update(restaurant.id, payload);
      } else {
        await base44.entities.Restaurant.create({ ...payload, user_id: user.id });
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
              <Label>Nome da Conta *</Label>
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
              <Label>Endereço para Envio *</Label>
              <div className="relative mt-1">
                <Input required value={form.zip_code} onChange={e => setForm({ ...form, zip_code: maskCEP(e.target.value) })} onBlur={handleCepBlur} placeholder="CEP: 00000-000" />
                {lookingUpCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-slate-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1">Digita o CEP que a gente preenche o resto sozinho.</p>
            </div>
            <Input required value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} placeholder="Rua / Avenida" />
            <Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} placeholder="Bairro" />
            <div className="grid grid-cols-2 gap-2">
              <Input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Cidade" />
              <Input required value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" />
            </div>
            <div>
              <Label>Observações do Endereço (opcional)</Label>
              <Textarea value={form.address_notes} onChange={e => setForm({ ...form, address_notes: e.target.value })} className="mt-1" rows={2} placeholder="Ex: portão azul, tocar interfone 2" />
            </div>
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
