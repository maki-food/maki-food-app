import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import WriteOffModal from '@/components/admin/WriteOffModal';
import StockItemForm from '@/components/admin/StockItemForm';
import { logAction } from '@/lib/audit';
import { AlertTriangle, Package, Minus, Plus, ClipboardMinus, PlusCircle } from 'lucide-react';

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const load = async () => {
    try { setProducts(await base44.entities.Product.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Product.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`stock-row-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, products]);

  const adjustStock = async (product, delta) => {
    try {
      if (delta > 0) {
        await base44.stock.addBatch({ productId: product.id, quantity: delta, expirationDate: null });
      } else if (delta < 0) {
        await base44.stock.deductFefo({ productId: product.id, quantity: -delta });
      }
      const newQty = Math.max(0, (product.stock_quantity || 0) + delta);
      await logAction('Estoque Ajustado', `${product.name}: ${product.stock_quantity} → ${newQty}`);
    } catch (err) {
      alert('Erro ao ajustar estoque: ' + (err.message || 'tente novamente'));
    }
  };

  const filtered = products.filter(p =>
    (p.name?.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)) &&
    (category === 'all' || p.category === category)
  );

  const categoryList = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  const lowCount = products.filter(p => p.stock_quantity <= (p.min_stock || 0)).length;

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controle de Estoque</h1>
          <p className="text-sm text-slate-500">{products.length} itens • {lowCount} com estoque baixo</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setNewItemOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="w-4 h-4 mr-1" /> Novo Item
          </Button>
          <Button onClick={() => setWriteOffOpen(true)} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
            <ClipboardMinus className="w-4 h-4 mr-1" /> Baixa de Estoque
          </Button>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <strong>{lowCount} {lowCount === 1 ? 'item está' : 'itens estão'}</strong> com estoque baixo. Considere fazer uma nova compra.
          </p>
        </div>
      )}

      <Input
        placeholder="Buscar por nome ou código..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {categoryList.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${category === c ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {c === 'all' ? 'Ver Todos' : c}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 text-xs text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
              <th className="px-4 py-3 text-center">Estoque Atual</th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">Mínimo</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Ajustar</th>
              <th className="px-4 py-3 text-center">Editar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const isLow = p.stock_quantity <= (p.min_stock || 0);
              const isHighlighted = highlightId === p.id;
              return (
                <tr key={p.id} id={`stock-row-${p.id}`} className={`border-t border-slate-50 hover:bg-slate-50 ${isHighlighted ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-slate-300" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                        <p className="text-xs text-slate-400">{(p.price || 0) > 0 ? 'publicado' : 'não publicado ainda'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500">{p.category || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-slate-900">{p.stock_quantity || 0}</span>
                    <span className="text-slate-400 text-sm ml-1">{p.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell text-sm text-slate-500">{p.min_stock || 0} {p.unit}</td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Baixo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => adjustStock(p, -1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => adjustStock(p, 1)} className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-600">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditingItem(p)} className="text-xs font-medium text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-slate-100">
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <WriteOffModal open={writeOffOpen} onClose={() => setWriteOffOpen(false)} products={products} onSave={load} />
      <StockItemForm
        item={editingItem}
        open={newItemOpen || !!editingItem}
        onClose={() => { setNewItemOpen(false); setEditingItem(null); }}
        onSave={load}
        onDelete={load}
      />
    </div>
  );
}
