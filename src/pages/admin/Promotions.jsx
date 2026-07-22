import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Tag, Loader2, Power, Package } from 'lucide-react';

export default function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: '', product_name: '', original_price: 0, promotional_price: 0, image_url: '' });

  const load = async () => {
    try {
      const [promos, prods] = await Promise.all([
        base44.entities.Promotion.list('-created_date'),
        base44.entities.Product.list(),
      ]);
      setPromotions(promos);
      setProducts(prods);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Promotion.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ product_id: '', product_name: '', original_price: 0, promotional_price: 0, image_url: '' });
    setFormOpen(true);
  };

  const openEdit = (promo) => {
    setEditing(promo);
    setForm({
      product_id: promo.product_id || '', product_name: promo.product_name || '',
      original_price: promo.original_price || 0, promotional_price: promo.promotional_price || 0,
      image_url: promo.image_url || '',
    });
    setFormOpen(true);
  };

  const selectProduct = (productId) => {
    const p = products.find(pr => pr.id === productId);
    if (p) {
      setForm(prev => ({
        ...prev, product_id: productId, product_name: p.name,
        original_price: p.price || 0, image_url: p.image_url || '',
        promotional_price: prev.promotional_price || 0,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id || !form.promotional_price) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        original_price: Number(form.original_price) || 0,
        promotional_price: Number(form.promotional_price) || 0,
      };
      if (editing) {
        await base44.entities.Promotion.update(editing.id, data);
        await logAction('Promoção Editada', `${data.product_name}: ${formatBRL(data.promotional_price)}`);
      } else {
        await base44.entities.Promotion.create(data);
        await logAction('Promoção Criada', `${data.product_name}: ${formatBRL(data.promotional_price)}`);
      }
      setFormOpen(false);
    } catch {}
    setSaving(false);
  };

  const toggleActive = async (promo) => {
    await base44.entities.Promotion.update(promo.id, { active: !promo.active });
    await logAction(promo.active ? 'Promoção Desativada' : 'Promoção Ativada', promo.product_name);
  };

  const handleDelete = async (promo) => {
    if (!confirm(`Excluir promoção de "${promo.product_name}"?`)) return;
    await base44.entities.Promotion.delete(promo.id);
    await logAction('Promoção Excluída', promo.product_name);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promoções do Dia</h1>
          <p className="text-sm text-slate-500">{promotions.filter(p => p.active).length} promoção(ões) ativa(s)</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Nova Promoção
        </Button>
      </div>

      {promotions.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Tag className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhuma promoção cadastrada</p>
          <p className="text-sm mt-1">Selecione um produto e defina um preço promocional</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map(promo => {
            const discount = promo.original_price > 0
              ? Math.round(((promo.original_price - promo.promotional_price) / promo.original_price) * 100)
              : 0;
            return (
              <div key={promo.id} className={`bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow ${!promo.active ? 'opacity-50' : ''}`}>
                <div className="aspect-video bg-slate-100 relative">
                  {promo.image_url ? (
                    <img src={promo.image_url} alt={promo.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-slate-300" /></div>
                  )}
                  {discount > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">-{discount}%</span>
                  )}
                  {!promo.active && (
                    <span className="absolute top-2 left-2 bg-slate-700 text-white text-xs px-2 py-1 rounded-full">Inativa</span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-900 truncate">{promo.product_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-400 line-through">{formatBRL(promo.original_price)}</span>
                    <span className="text-lg font-bold text-emerald-600">{formatBRL(promo.promotional_price)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
                    <button onClick={() => toggleActive(promo)} className={`p-2 rounded-lg ${promo.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`} title={promo.active ? 'Desativar' : 'Ativar'}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(promo)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(promo)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 ml-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Promoção' : 'Nova Promoção'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Produto *</Label>
              <Select value={form.product_id} onValueChange={selectProduct} disabled={!!editing}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.product_id && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div>
                  <Label className="text-xs">Preço Atual</Label>
                  <p className="text-lg font-bold text-slate-400 line-through">{formatBRL(form.original_price)}</p>
                </div>
                <div>
                  <Label className="text-xs">Preço Promocional *</Label>
                  <Input type="number" step="0.01" required value={form.promotional_price} onChange={e => setForm({ ...form, promotional_price: e.target.value })} className="mt-1" placeholder="0,00" />
                </div>
                {form.promotional_price > 0 && form.original_price > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Desconto</span>
                    <span className="font-bold text-red-500">
                      {formatBRL(form.original_price - Number(form.promotional_price))} ({Math.round(((form.original_price - Number(form.promotional_price)) / form.original_price) * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !form.product_id} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}