import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL } from '@/lib/format';
import { Button } from '@/components/ui/button';
import ProductForm from '@/components/admin/ProductForm';
import { Plus, Pencil, Trash2, Package, Star, Pause, Play, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/lib/permissions';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { user } = useAuth();
  const canManage = hasPermission(user, 'products_manage');

  const load = async () => {
    try { setProducts(await base44.entities.Product.list('-created_date')); } catch {}
    setLoading(false);
  };

  const updateProductList = (event) => {
    setProducts(prev => {
      if (!event?.data) return prev;
      const item = event.data;
      if (event.type === 'create') return [item, ...prev];
      if (event.type === 'update') return prev.map(p => p.id === item.id ? { ...p, ...item } : p);
      if (event.type === 'delete') return prev.filter(p => p.id !== event.id);
      return prev;
    });
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Product.subscribe(updateProductList);
    return () => { if (unsub) unsub(); };
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Excluir este produto?')) return;
    await base44.entities.Product.delete(id);
  };

  const togglePause = async (p) => {
    await base44.entities.Product.update(p.id, { available: p.available === false });
  };

  const toggleHighlight = async (p) => {
    await base44.entities.Product.update(p.id, { is_promotion: !p.is_promotion });
  };

  const toggleNew = async (p) => {
    await base44.entities.Product.update(p.id, { is_new: !p.is_new });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500">{products.length} produtos cadastrados</p>
        </div>
        {canManage && <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Novo Produto
        </Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Package className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Produto" para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3 hidden sm:table-cell">Estoque</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{p.name}{p.available === false && <span className="ml-2 text-xs font-normal text-red-500">(pausado)</span>}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.barcode || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500">{p.category || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatBRL(p.price)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-sm font-medium ${p.stock_quantity <= (p.min_stock || 0) ? 'text-amber-600' : 'text-slate-600'}`}>
                      {p.stock_quantity} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && <div className="flex justify-end gap-1">
                      <button onClick={() => toggleHighlight(p)} title="Marcar como destaque" className={`p-2 rounded-lg hover:bg-slate-100 ${p.is_promotion ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                        <Star className={`w-4 h-4 ${p.is_promotion ? 'fill-amber-500' : ''}`} />
                      </button>
                      <button onClick={() => toggleNew(p)} title={p.is_new ? 'Remover de Novos Produtos' : 'Marcar como Novo'} className={`p-2 rounded-lg hover:bg-slate-100 ${p.is_new ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}>
                        <Sparkles className={`w-4 h-4 ${p.is_new ? 'fill-blue-500' : ''}`} />
                      </button>
                      <button onClick={() => togglePause(p)} title={p.available === false ? 'Despausar' : 'Pausar'} className={`p-2 rounded-lg hover:bg-slate-100 ${p.available === false ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}>
                        {p.available === false ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setEditing(p); setFormOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductForm product={editing} open={formOpen} onClose={() => setFormOpen(false)} onSave={load} />
    </div>
  );
}