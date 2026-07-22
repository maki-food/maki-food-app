import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Loader2, Truck, Package, Fuel, Plus, Pencil, Trash2 } from 'lucide-react';

export default function FichaTecnica() {
  const [fichas, setFichas] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: '', product_name: '',
    supplier_transport: 0, packaging: 0, fuel: 0, other_costs: 0,
    purchase_cost: 0, selling_price: 0, profit_margin_pct: 30, tax_fee_pct: 4.99,
  });

  const load = async () => {
    try {
      const [f, p] = await Promise.all([
        base44.entities.FichaTecnica.list('-created_date'),
        base44.entities.Product.list(),
      ]);
      setFichas(f); setProducts(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.FichaTecnica.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ product_id: '', product_name: '', supplier_transport: 0, packaging: 0, fuel: 0, other_costs: 0, purchase_cost: 0, selling_price: 0, profit_margin_pct: 30, tax_fee_pct: 4.99 });
    setFormOpen(true);
  };

  const openEdit = (ficha) => {
    setEditing(ficha);
    setForm({
      product_id: ficha.product_id || '', product_name: ficha.product_name || '',
      supplier_transport: ficha.supplier_transport || 0, packaging: ficha.packaging || 0,
      fuel: ficha.fuel || 0, other_costs: ficha.other_costs || 0,
      purchase_cost: ficha.purchase_cost || 0, selling_price: ficha.selling_price || 0,
      profit_margin_pct: ficha.profit_margin_pct || 0, tax_fee_pct: ficha.tax_fee_pct || 0,
    });
    setFormOpen(true);
  };

  const selectProduct = (productId) => {
    const p = products.find(pr => pr.id === productId);
    if (p) {
      setForm(prev => ({
        ...prev, product_id: productId, product_name: p.name,
        purchase_cost: p.purchase_cost || prev.purchase_cost,
        selling_price: p.price || prev.selling_price,
      }));
    }
  };

  const totalCosts = (Number(form.supplier_transport) || 0) + (Number(form.packaging) || 0) + (Number(form.fuel) || 0) + (Number(form.other_costs) || 0) + (Number(form.purchase_cost) || 0);
  const marginValue = totalCosts * ((Number(form.profit_margin_pct) || 0) / 100);
  const taxValue = (totalCosts + marginValue) * ((Number(form.tax_fee_pct) || 0) / 100);
  const calculatedFinal = totalCosts + marginValue + taxValue;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_name) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        supplier_transport: Number(form.supplier_transport) || 0,
        packaging: Number(form.packaging) || 0,
        fuel: Number(form.fuel) || 0,
        other_costs: Number(form.other_costs) || 0,
        purchase_cost: Number(form.purchase_cost) || 0,
        selling_price: Number(form.selling_price) || 0,
        profit_margin_pct: Number(form.profit_margin_pct) || 0,
        tax_fee_pct: Number(form.tax_fee_pct) || 0,
        final_price: calculatedFinal,
      };
      if (editing) {
        await base44.entities.FichaTecnica.update(editing.id, data);
        await logAction('Ficha Técnica Editada', data.product_name);
      } else {
        await base44.entities.FichaTecnica.create(data);
        await logAction('Ficha Técnica Criada', data.product_name);
      }
      setFormOpen(false);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (ficha) => {
    if (!confirm(`Excluir ficha técnica de "${ficha.product_name}"?`)) return;
    await base44.entities.FichaTecnica.delete(ficha.id);
    await logAction('Ficha Técnica Excluída', ficha.product_name);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ficha Técnica</h1>
          <p className="text-sm text-slate-500">Engenharia de custos e precificação</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Nova Ficha
        </Button>
      </div>

      {fichas.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Calculator className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhuma ficha técnica cadastrada</p>
          <p className="text-sm mt-1">Crie uma ficha para calcular custos e margens</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {fichas.map(f => {
            const totalC = (f.supplier_transport || 0) + (f.packaging || 0) + (f.fuel || 0) + (f.other_costs || 0) + (f.purchase_cost || 0);
            const profit = (f.selling_price || 0) - totalC - ((f.selling_price || 0) * ((f.tax_fee_pct || 0) / 100));
            return (
              <div key={f.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{f.product_name}</p>
                    <p className="text-xs text-slate-400">Margem: {f.profit_margin_pct}% • Taxa: {f.tax_fee_pct}%</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(f)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(f)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-500"><Truck className="w-3.5 h-3.5" /> Transporte: {formatBRL(f.supplier_transport)}</div>
                  <div className="flex items-center gap-2 text-slate-500"><Package className="w-3.5 h-3.5" /> Embalagem: {formatBRL(f.packaging)}</div>
                  <div className="flex items-center gap-2 text-slate-500"><Fuel className="w-3.5 h-3.5" /> Combustível: {formatBRL(f.fuel)}</div>
                  <div className="flex items-center gap-2 text-slate-500">Custo Total: <strong className="text-slate-700">{formatBRL(totalC)}</strong></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Preço de Venda</p>
                    <p className="font-bold text-slate-900">{formatBRL(f.selling_price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Lucro Líquido</p>
                    <p className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatBRL(profit)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-4">{editing ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}</h2>
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

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custos Operacionais</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Custo de Compra</Label>
                    <Input type="number" step="0.01" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Transporte Fornecedor</Label>
                    <Input type="number" step="0.01" value={form.supplier_transport} onChange={e => setForm({ ...form, supplier_transport: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Embalagem</Label>
                    <Input type="number" step="0.01" value={form.packaging} onChange={e => setForm({ ...form, packaging: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Combustível</Label>
                    <Input type="number" step="0.01" value={form.fuel} onChange={e => setForm({ ...form, fuel: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Outros Custos</Label>
                    <Input type="number" step="0.01" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Precificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Preço de Venda</Label>
                    <Input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Margem (%)</Label>
                    <Input type="number" step="0.01" value={form.profit_margin_pct} onChange={e => setForm({ ...form, profit_margin_pct: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Taxa Cartão (%)</Label>
                    <Input type="number" step="0.01" value={form.tax_fee_pct} onChange={e => setForm({ ...form, tax_fee_pct: e.target.value })} className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Custo Total</p>
                  <p className="font-bold">{formatBRL(totalCosts)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Preço Final Calculado</p>
                  <p className="font-bold text-emerald-400">{formatBRL(calculatedFinal)}</p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}