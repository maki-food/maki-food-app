import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatDate } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { maskPhone, maskCNPJ, maskCEP } from '@/lib/masks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Store, Mail, Phone, MapPin, FileText, Users, Pencil, Trash2, Loader2 } from 'lucide-react';

export default function ClientsTab() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [profilesByUser, setProfilesByUser] = useState({});

  const load = async () => {
    try {
      const [rests, profiles] = await Promise.all([
        base44.entities.Restaurant.list('-created_date'),
        base44.entities.User.list(),
      ]);
      setRestaurants(rests);
      const map = {};
      for (const p of profiles) map[p.id] = p;
      setProfilesByUser(map);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Restaurant.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  // Only show fully registered clients (must have at least name + contact + street)
  const fullyRegistered = restaurants.filter(r =>
    r.restaurant_name && r.contact_number && (r.street || r.address)
  );

  const openEdit = (r) => {
    setEditing(r);
    setEditForm({
      account_name: r.account_name || '', restaurant_name: r.restaurant_name || '', cnpj: r.cnpj || '', contact_number: r.contact_number || '',
      street: r.street || '', neighborhood: r.neighborhood || '', city: r.city || '', state: r.state || '', zip_code: r.zip_code || '',
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fullAddr = [editForm.street, editForm.neighborhood, editForm.city, editForm.state, editForm.zip_code].filter(Boolean).join(', ');
      await base44.entities.Restaurant.update(editing.id, { ...editForm, address: fullAddr });
      await logAction('Cliente Editado', editForm.restaurant_name);
      setEditing(null);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (r) => {
    if (!confirm(`Excluir cliente "${r.restaurant_name}"?`)) return;
    await base44.entities.Restaurant.delete(r.id);
    await logAction('Cliente Excluído', r.restaurant_name);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  if (fullyRegistered.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
        <Store className="w-12 h-12 mx-auto mb-3" />
        <p className="font-medium">Nenhum cliente totalmente cadastrado</p>
        <p className="text-sm mt-1">Clientes aparecem aqui após completarem o cadastro</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">{fullyRegistered.length} clientes cadastrados</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fullyRegistered.map(r => {
          const profile = profilesByUser[r.user_id];
          return (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {r.account_name || profile?.full_name || profile?.email || 'Cliente sem nome'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">tem o restaurante <span className="font-medium">{r.restaurant_name}</span></p>
                  <p className="text-xs text-slate-400">Desde {formatDate(r.created_date)}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(r)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(r)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              {profile?.email && <p className="flex items-center gap-2 text-slate-500"><Mail className="w-3.5 h-3.5" /> {profile.email}</p>}
              {r.cnpj && <p className="flex items-center gap-2 text-slate-500"><FileText className="w-3.5 h-3.5" /> CNPJ: {r.cnpj}</p>}
              {r.contact_number && <p className="flex items-center gap-2 text-slate-500"><Phone className="w-3.5 h-3.5" /> {r.contact_number}</p>}
              {(r.street || r.address) && (
                <p className="flex items-start gap-2 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {[r.street, r.neighborhood, r.city, r.state, r.zip_code].filter(Boolean).join(', ') || r.address}
                </p>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            {editing && profilesByUser[editing.user_id]?.email && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 -mt-1">
                <Mail className="w-3.5 h-3.5" /> {profilesByUser[editing.user_id].email}
              </p>
            )}
            <div>
              <Label>Nome do Cliente *</Label>
              <Input required value={editForm.account_name || ''} onChange={e => setEditForm({ ...editForm, account_name: e.target.value })} className="mt-1" placeholder="Nome de quem está cadastrado" />
            </div>
            <div>
              <Label>Nome do Restaurante *</Label>
              <Input required value={editForm.restaurant_name || ''} onChange={e => setEditForm({ ...editForm, restaurant_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={editForm.cnpj || ''} onChange={e => setEditForm({ ...editForm, cnpj: maskCNPJ(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={editForm.contact_number || ''} onChange={e => setEditForm({ ...editForm, contact_number: maskPhone(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={editForm.zip_code || ''} onChange={e => setEditForm({ ...editForm, zip_code: maskCEP(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <Label>Rua</Label>
              <Input value={editForm.street || ''} onChange={e => setEditForm({ ...editForm, street: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={editForm.neighborhood || ''} onChange={e => setEditForm({ ...editForm, neighborhood: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cidade</Label>
                <Input value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value.toUpperCase().slice(0, 2) })} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}