import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import WriteOffModal from '@/components/admin/WriteOffModal';
import ReturnStockModal from '@/components/admin/ReturnStockModal';
import StockItemForm from '@/components/admin/StockItemForm';
import { logAction } from '@/lib/audit';
import { AlertTriangle, Package, Plus, ClipboardMinus, PlusCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/lib/permissions';

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [returnStockOpen, setReturnStockOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'stock_edit');
  const canWriteoff = canEdit || hasPermission(user, 'stock_writeoff');

  const load = async () => {
    try { setProducts(await base44.entities.Product.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();

    const unsub = base44.entities.Product.subscribe((event) => {
      console.log('🔄 Stock page received realtime event:', event?.type);
      load();
    });

    // CONTORNO: descobrimos (testando em conjunto com o dono do projeto)
    // que uma transação que atualiza 'products' E insere em 'orders' ao
    // mesmo tempo (exatamente o que acontece no checkout do cliente) faz
    // o Supabase Realtime NÃO entregar o evento de 'products' — mesmo com
    // toda a configuração (RLS, replicação, publicação) confirmada
    // correta. É um comportamento específico do Realtime nessa situação,
    // não um bug do nosso código. Testado e confirmado: o evento de
    // 'orders' da MESMA transação chega normalmente. Então, além de
    // escutar 'products' diretamente (cobre ajustes manuais de estoque,
    // compras, devoluções — que continuam funcionando em tempo real
    // normalmente), também escutamos 'orders' aqui e recarregamos os
    // produtos quando qualquer pedido for criado/editado/excluído — isso
    // cobre exatamente o caso que estava faltando (cliente finalizando
    // pedido) sem depender do evento de 'products' que não chega.
    const unsubOrders = base44.entities.Order.subscribe((event) => {
      console.log('🔄 Stock page received realtime event (via orders):', event?.type);
      load();
    });

    return () => {
      if (unsub) unsub();
      if (unsubOrders) unsubOrders();
    };
  }, []);

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`stock-row-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, products]);


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
          {canEdit && <Button onClick={() => setNewItemOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="w-4 h-4 mr-1" /> Novo Item
          </Button>}
          {canWriteoff && <Button onClick={() => setReturnStockOpen(true)} variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50">
            <Plus className="w-4 h-4 mr-1" /> Devolver ao Estoque
          </Button>}
          {canWriteoff && <Button onClick={() => setWriteOffOpen(true)} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
            <ClipboardMinus className="w-4 h-4 mr-1" /> Baixa de Estoque
          </Button>}
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
              {canEdit && <th className="px-4 py-3 text-center">Editar</th>}
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
                  {canEdit && <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditingItem(p)} className="text-xs font-medium text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-slate-100">Editar</button>
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <WriteOffModal open={writeOffOpen} onClose={() => setWriteOffOpen(false)} products={products} onSave={load} />
      <ReturnStockModal open={returnStockOpen} onClose={() => setReturnStockOpen(false)} products={products} onSave={load} />
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
