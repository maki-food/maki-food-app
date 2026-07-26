import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import ProductCard from '@/components/ProductCard';
import { Package, Plus, Trash2, Search, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ListIcon from '@/components/client/ListIcon';

export default function Lists() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('essenciais'); // 'essenciais' | 'listas'
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4">
        <div className="w-24 h-24 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
          <ListIcon className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Entrar para ver suas listas</h1>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">Assim que aceder à sua conta, encontrará todas as suas listas aqui.</p>
        <Link to="/login" className="w-full max-w-xs">
          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700">Entrar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1 mb-6 max-w-sm">
        <button
          onClick={() => setTab('essenciais')}
          className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${tab === 'essenciais' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          Meus essenciais
        </button>
        <button
          onClick={() => setTab('listas')}
          className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${tab === 'listas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          Listas
        </button>
      </div>

      {tab === 'essenciais' ? <MyEssentials userId={user.id} navigate={navigate} /> : <MyLists userId={user.id} />}
    </div>
  );
}

function MyEssentials({ userId, navigate }) {
  const [loading, setLoading] = useState(true);
  const [essentials, setEssentials] = useState([]);
  const [hasOrders, setHasOrders] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const orders = await base44.entities.Order.filter({ created_by_id: userId });
        if (!orders || orders.length === 0) { setHasOrders(false); setLoading(false); return; }
        setHasOrders(true);
        const freq = {};
        for (const o of orders) {
          for (const item of (o.items || [])) {
            const key = item.product_name;
            if (!key) continue;
            freq[key] = (freq[key] || 0) + 1;
          }
        }
        const topNames = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name);
        const allProducts = await base44.entities.Product.list();
        const matched = topNames.map(name => allProducts.find(p => p.name === name)).filter(p => p && (p.price || 0) > 0);
        setEssentials(matched);
      } catch {}
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  if (!hasOrders) {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4">
        <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center mb-5">
          <Package className="w-9 h-9 text-slate-300" />
        </div>
        <h2 className="font-bold text-slate-900 mb-2">Ainda não fez compras suficientes</h2>
        <p className="text-sm text-slate-500 max-w-xs">Assim que fizer um pedido, poderá ver os produtos que compra com mais frequência.</p>
      </div>
    );
  }

  if (essentials.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Package className="w-12 h-12 mx-auto mb-3" />
        <p className="font-medium">Nenhum produto dos seus pedidos está disponível agora</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {essentials.map(product => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}

function MyLists({ userId }) {
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState([]);
  const [counts, setCounts] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailList, setDetailList] = useState(null);

  const load = async () => {
    try {
      const rows = await base44.entities.List.filter({ user_id: userId }, '-created_date');
      setLists(rows);
      const countMap = {};
      for (const l of rows) {
        const items = await base44.entities.ListItem.filter({ list_id: l.id });
        countMap[l.id] = items.length;
      }
      setCounts(countMap);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await base44.entities.List.create({ user_id: userId, name: newName.trim() });
      setNewName('');
      setCreateOpen(false);
      load();
    } catch {}
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await base44.entities.List.delete(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch {}
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {lists.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 px-4">
          <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
            <ListIcon className="w-9 h-9 text-emerald-500" />
          </div>
          <h2 className="font-bold text-slate-900 mb-2">Você ainda não tem listas</h2>
          <p className="text-sm text-slate-500 max-w-xs mb-5">Crie listas com os produtos que você compra sempre, pra adicionar tudo ao carrinho de uma vez.</p>
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-1.5" /> Criar nova lista
          </Button>
        </div>
      ) : (
        <>
          <button onClick={() => setCreateOpen(true)} className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-slate-200 rounded-2xl py-4 mb-4 text-emerald-600 font-medium hover:bg-emerald-50">
            <Plus className="w-4 h-4" /> Criar nova lista
          </button>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {lists.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50">
                <button onClick={() => setDetailList(l)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <ListIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{l.name}</p>
                    <p className="text-xs text-slate-400">{counts[l.id] || 0} produto(s)</p>
                  </div>
                </button>
                <button onClick={() => setDetailList(l)} className="p-2 text-slate-300"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete(l)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Criar nova lista</DialogTitle></DialogHeader>
          <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Compra de sempre" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-emerald-600 hover:bg-emerald-700">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Apagar a lista "{confirmDelete?.name}"?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailList && (
        <ListDetailDialog list={detailList} onClose={() => { setDetailList(null); load(); }} />
      )}
    </div>
  );
}

function ListDetailDialog({ list, onClose }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const load = async () => {
    try {
      const rows = await base44.entities.ListItem.filter({ list_id: list.id });
      const allProducts = await base44.entities.Product.list();
      setProducts(allProducts);
      setItems(rows.map(r => ({ ...r, product: allProducts.find(p => p.id === r.product_id) })).filter(i => i.product));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [list.id]);

  const results = search
    ? products.filter(p => (p.price || 0) > 0 && p.name?.toLowerCase().includes(search.toLowerCase()) && !items.find(i => i.product_id === p.id))
    : [];

  const addProduct = async (product) => {
    try {
      await base44.entities.ListItem.create({ list_id: list.id, product_id: product.id, quantity: 1 });
      setSearch('');
      load();
    } catch {}
  };

  const removeItem = async (itemId) => {
    try {
      await base44.entities.ListItem.delete(itemId);
      load();
    } catch {}
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{list.name}</DialogTitle></DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar produtos" className="pl-9" />
        </div>
        {results.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {results.slice(0, 6).map(p => (
              <button key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 text-left">
                {p.name}
                <Plus className="w-4 h-4 text-emerald-600" />
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Nenhum produto nessa lista ainda. Procura aí em cima pra adicionar.</p>
        ) : (
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
                  {i.product.image_url ? <img src={i.product.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-slate-300" />}
                </div>
                <p className="flex-1 text-sm font-medium text-slate-900 truncate">{i.product.name}</p>
                <button onClick={() => removeItem(i.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
