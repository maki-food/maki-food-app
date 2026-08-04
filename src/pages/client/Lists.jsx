import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import { Package, Plus, Minus, Trash2, Search, ChevronRight, X, ShoppingCart, MoreVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ListIcon from '@/components/client/ListIcon';

export default function Lists() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('listas'); // 'essenciais' | 'listas'
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div>
        <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1 mb-6 max-w-sm">
          <button className="flex-1 text-sm font-medium py-2 rounded-full text-slate-500">Meus essenciais</button>
          <button className="flex-1 text-sm font-medium py-2 rounded-full text-slate-500">Listas</button>
        </div>
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      </div>
    );
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
    const unsubP = base44.entities.Product.subscribe(() => load());
    const unsubV = base44.entities.ProductVariant.subscribe(() => load());
    return () => { if (unsubP) unsubP(); if (unsubV) unsubV(); };
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
  const [previews, setPreviews] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailList, setDetailList] = useState(null);

  const load = async () => {
    try {
      const rows = await base44.entities.List.filter({ user_id: userId }, '-created_date');
      setLists(rows);
      const allProducts = await base44.entities.Product.list();
      const itemGroups = await Promise.all(rows.map(async l => {
        const items = await base44.entities.ListItem.filter({ list_id: l.id });
        return [l.id, items];
      }));
      const countMap = {};
      const previewMap = {};
      itemGroups.forEach(([listId, items]) => {
        countMap[listId] = items.length;
        previewMap[listId] = items
          .map(item => allProducts.find(product => product.id === item.product_id))
          .filter(Boolean)
          .slice(0, 4);
      });
      setCounts(countMap);
      setPreviews(previewMap);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsubP = base44.entities.Product.subscribe(() => load());
    const unsubV = base44.entities.ProductVariant.subscribe(() => load());
    return () => { if (unsubP) unsubP(); if (unsubV) unsubV(); };
  }, [userId]);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lists.map(l => (
              <div key={l.id} className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                <button onClick={() => setDetailList(l)} className="flex w-full items-center gap-4 text-left">
                  <div className="grid h-24 w-24 flex-shrink-0 grid-cols-2 gap-1 overflow-hidden rounded-xl bg-slate-50 p-1">
                    {(previews[l.id] || []).map(product => (
                      <div key={product.id} className="flex items-center justify-center overflow-hidden rounded-md bg-white">
                        {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-contain" /> : <Package className="h-5 w-5 text-slate-300" />}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - (previews[l.id] || []).length) }).map((_, index) => (
                      <div key={`empty-${index}`} className="rounded-md bg-slate-100" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-slate-900">{l.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{counts[l.id] || 0} produto(s)</p>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300 group-hover:text-emerald-600" />
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
  const { addItem } = useCart();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [listName, setListName] = useState(list.name);
  const [savingName, setSavingName] = useState(false);

  const load = async () => {
    try {
      const rows = await base44.entities.ListItem.filter({ list_id: list.id });
      const allProducts = await base44.entities.Product.list();
      const allVariants = await base44.entities.ProductVariant.list().catch(() => []);
      setProducts(allProducts);
      setVariantsByProduct(allVariants.reduce((groups, variant) => {
        if (!groups[variant.product_id]) groups[variant.product_id] = [];
        groups[variant.product_id].push(variant);
        return groups;
      }, {}));
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

  const updateListQuantity = async (item, quantity) => {
    if (quantity <= 0) return removeItem(item.id);
    setItems(prev => prev.map(current => current.id === item.id ? { ...current, quantity } : current));
    try {
      await base44.entities.ListItem.update(item.id, { quantity });
    } catch {
      load();
    }
  };

  const addAllToCart = () => {
    items.forEach(item => addItem(item.product, item.quantity || 1));
  };

  const saveName = async () => {
    if (!listName.trim()) return;
    setSavingName(true);
    try {
      await base44.entities.List.update(list.id, { name: listName.trim() });
      setEditingName(false);
    } catch {}
    setSavingName(false);
  };

  const deleteList = async () => {
    if (!window.confirm(`Excluir a lista "${list.name}"?`)) return;
    try {
      await base44.entities.List.delete(list.id);
      onClose();
    } catch {}
  };

  const totalProducts = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="h-[94vh] w-[min(96vw,1180px)] max-w-none overflow-y-auto bg-white p-0">
        <div className="min-h-full px-5 pb-8 pt-4 sm:px-8 lg:px-12">
          <button type="button" onClick={onClose} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700">
            <ChevronRight className="h-4 w-4 rotate-180" /> Voltar às listas
          </button>

          <div className="text-center">
            {editingName ? (
              <div className="mx-auto flex max-w-sm gap-2">
                <Input value={listName} onChange={e => setListName(e.target.value)} autoFocus />
                <Button onClick={saveName} disabled={savingName || !listName.trim()}>Salvar</Button>
              </div>
            ) : <DialogTitle className="text-3xl font-bold text-slate-900">{listName}</DialogTitle>}
            <p className="mt-2 text-base text-slate-500">{totalProducts} produtos</p>
          </div>

          <div className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-8 border-b border-slate-200 pb-7 sm:gap-20">
            <button type="button" onClick={addAllToCart} disabled={items.length === 0} className="group flex w-36 flex-col items-center gap-2 text-center disabled:opacity-40">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-700 shadow-sm transition group-hover:border-emerald-300 group-hover:bg-emerald-50"><ShoppingCart className="h-7 w-7" /></span>
              <span className="text-sm font-medium text-slate-600">Adicione tudo ao carrinho</span>
            </button>
            <button type="button" onClick={() => document.getElementById(`list-search-${list.id}`)?.focus()} className="group flex w-36 flex-col items-center gap-2 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:border-emerald-300 group-hover:bg-emerald-50"><Plus className="h-7 w-7" /></span>
              <span className="text-sm font-medium text-slate-600">Adicionar mais produtos</span>
            </button>
            <div className="relative flex w-36 flex-col items-center gap-2 text-center">
              <button type="button" onClick={() => setOptionsOpen(value => !value)} className="group flex flex-col items-center gap-2">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:border-emerald-300 group-hover:bg-emerald-50"><MoreVertical className="h-7 w-7" /></span>
                <span className="text-sm font-medium text-slate-600">Opções</span>
              </button>
              {optionsOpen && <div className="absolute right-0 top-[78px] z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl">
                <button type="button" onClick={() => { setEditingName(true); setOptionsOpen(false); }} className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"><Pencil className="h-4 w-4" /> Editar nome da lista</button>
                <button type="button" onClick={deleteList} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-3 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Excluir lista</button>
              </div>}
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-5xl">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input id={`list-search-${list.id}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Adicionar mais produtos à lista" className="pl-9" />
            </div>
            {results.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {results.slice(0, 6).map(product => <button key={product.id} onClick={() => addProduct(product)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50">{product.name}<Plus className="h-4 w-4 text-emerald-600" /></button>)}
            </div>}
          </div>

          {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" /></div> : items.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Nenhum produto nessa lista ainda.</p> : <div className="mx-auto mt-7 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map(item => <div key={item.id} className="min-w-0">
              <ProductCard product={item.product} variants={variantsByProduct[item.product.id] || []} />
              <div className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700"><span className="sm:hidden">{item.quantity || 1} und</span><span className="hidden sm:inline">{item.quantity || 1} {(Number(item.quantity) || 1) === 1 ? 'unidade' : 'unidades'}</span></span>
                <button type="button" onClick={() => updateListQuantity(item, (Number(item.quantity) || 1) - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">{(Number(item.quantity) || 1) <= 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</button>
                <button type="button" onClick={() => updateListQuantity(item, (Number(item.quantity) || 1) + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"><Plus className="h-4 w-4" /></button>
              </div>
            </div>)}
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
