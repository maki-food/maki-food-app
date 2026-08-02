import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useCart } from '@/context/CartContext';
import { formatBRL } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Trash2, Package, Star, Heart, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProductCard({ product, promoPrice, variants = [] }) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [variantId, setVariantId] = useState(variants[0]?.id || '');
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [lists, setLists] = useState([]);
  const [savedListIds, setSavedListIds] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);

  const selectedVariant = useMemo(() => variants.find(v => v.id === variantId) || null, [variants, variantId]);
  const hasVariants = variants.length > 0;

  const navigate = useNavigate();
  const handleGoToCategory = () => {
    const category = product.category_name || product.category;
    if (!category) return;
    navigate(`/loja/categorias?categoria=${encodeURIComponent(category)}`);
  };

  const outOfStock = (product.stock_quantity || 0) <= 0;
  const isPaused = product.available === false;
  const unavailable = outOfStock || isPaused;
  const displayPrice = hasVariants ? (selectedVariant?.price ?? 0) : (promoPrice !== undefined ? promoPrice : product.price);
  const hasDiscount = !hasVariants && promoPrice !== undefined && promoPrice < product.price;
  const isWeight = product.unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(product.unit);
  const hasLongDescription = product.description && product.description.length > 70;
  const step = hasVariants ? 1 : (isWeight ? 0.5 : 1);

  // Quantas unidades da variação selecionada ainda cabem no estoque disponível (em kg)
  const maxAvailable = (hasVariants && selectedVariant?.default_weight_kg)
    ? Math.max(0, Math.floor((product.stock_quantity || 0) / selectedVariant.default_weight_kg))
    : product.stock_quantity;

  // Já está no carrinho? (considera a variação selecionada, se houver)
  const activeVariantId = hasVariants ? (selectedVariant?.id || null) : null;
  const cartItem = items.find(i => i.product_id === product.id && (i.variant_id || null) === activeVariantId);
  const cartQty = cartItem?.quantity || 0;

  const handleAdd = () => {
    if (unavailable || (hasVariants && !selectedVariant)) return;
    addItem({ ...product, price: displayPrice }, step, hasVariants ? selectedVariant : null);
  };

  const handleIncrease = () => {
    if (cartQty + step > maxAvailable) return;
    updateQuantity(product.id, cartQty + step, activeVariantId);
  };

  const handleDecrease = () => {
    const next = cartQty - step;
    if (next <= 0) removeItem(product.id, activeVariantId);
    else updateQuantity(product.id, next, activeVariantId);
  };

  const loadLists = async () => {
    setListsLoading(true);
    try {
      const user = await base44.auth.me();
      const userLists = await base44.entities.List.filter({ user_id: user.id }, '-created_date');
      const memberships = await Promise.all(userLists.map(async list => {
        const entries = await base44.entities.ListItem.filter({ list_id: list.id });
        return entries.some(entry => entry.product_id === product.id) ? list.id : null;
      }));
      setLists(userLists);
      setSavedListIds(memberships.filter(Boolean));
    } catch {
      setLists([]);
      setSavedListIds([]);
    }
    setListsLoading(false);
  };

  const toggleList = async (list) => {
    const isSaved = savedListIds.includes(list.id);
    try {
      const entries = await base44.entities.ListItem.filter({ list_id: list.id });
      const existing = entries.find(entry => entry.product_id === product.id);
      if (isSaved && existing) {
        await base44.entities.ListItem.delete(existing.id);
        setSavedListIds(prev => prev.filter(id => id !== list.id));
      } else if (!isSaved) {
        await base44.entities.ListItem.create({ list_id: list.id, product_id: product.id, quantity: 1 });
        setSavedListIds(prev => [...prev, list.id]);
      }
    } catch {}
  };

  useEffect(() => {
    if (detailOpen) loadLists();
  }, [detailOpen]);

  return (
    <>
      <div className={`group relative h-full bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-emerald-200 transition-all duration-300 flex flex-col ${unavailable ? 'opacity-50' : ''} ${product.is_promotion || hasDiscount ? 'ring-2 ring-amber-300' : ''}`}>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="aspect-square bg-slate-100 overflow-hidden relative w-full text-left cursor-zoom-in"
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="eager" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-12 h-12" /></div>
          )}
          {(product.is_promotion || hasDiscount) && (
            <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <Star className="w-3 h-3 fill-white" /> Promoção
            </span>
          )}
        </button>
        <div className="p-4 flex flex-col flex-1 min-h-0">
          <button type="button" onClick={() => setDetailOpen(true)} className="text-left">
            <h3 className="font-semibold text-slate-900 leading-tight hover:text-emerald-700 line-clamp-2 overflow-hidden">{product.name}</h3>
          </button>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2 overflow-hidden">
            {product.description}
            {hasLongDescription && (
              <button type="button" onClick={() => setDetailOpen(true)} className="text-emerald-600 font-medium ml-1 hover:underline">
                ver mais
              </button>
            )}
          </p>

          {hasVariants && !unavailable && (
            <div className="mt-2">
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
                <SelectContent>
                  {variants.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name} — {formatBRL(v.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mt-auto pt-3 flex flex-col gap-2">
            <div>
              {hasDiscount && (
                <p className="text-xs text-slate-400 line-through">{formatBRL(product.price)}</p>
              )}
              <p className="text-lg font-bold text-emerald-600">{formatBRL(displayPrice)}</p>
              {!hasVariants && <p className="text-xs text-slate-400">por {product.unit || 'un'}</p>}
            </div>
            {unavailable ? (
              <span className="text-sm font-medium text-slate-400 px-3 py-2 text-center bg-slate-50 rounded-lg">
                {isPaused ? 'Indisponível no momento' : 'Indisponível'}
              </span>
            ) : cartQty > 0 ? (
              <div className="flex items-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700"><span className="sm:hidden">{cartQty} und</span><span className="hidden sm:inline">{cartQty} {cartQty === 1 ? 'unidade' : 'unidades'}</span></span>
                <button type="button" onClick={handleDecrease} className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100">
                  {cartQty <= step ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </button>
                <button type="button" onClick={handleIncrease} disabled={cartQty + step > maxAvailable} className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-700 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-30">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button onClick={handleAdd} disabled={hasVariants && !selectedVariant} className="w-full bg-slate-900 hover:bg-slate-800">
                Adicionar
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[94vh] w-[min(96vw,1200px)] max-w-none overflow-y-auto p-0">
          <div className="grid min-h-[560px] grid-cols-1 gap-0 bg-white md:grid-cols-2">
            <div className="flex flex-col bg-slate-50 p-5 sm:p-8">
              <button type="button" onClick={handleGoToCategory} className="mb-5 text-sm font-medium text-emerald-600 hover:text-emerald-700 text-left">
                {product.category_name || product.category || 'Produtos'}
              </button>
              <button type="button" onClick={() => setZoomOpen(true)} className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-white p-5 cursor-zoom-in">
                {product.image_url ? <img src={product.image_url} alt={product.name} className="max-h-[520px] w-full object-contain" /> : <Package className="h-24 w-24 text-slate-300" />}
              </button>
            </div>

            <div className="flex flex-col p-5 sm:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold leading-tight sm:text-3xl">{product.name}</DialogTitle>
              </DialogHeader>
              {product.description && <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-slate-500">{product.description}</p>}
              <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                <p className="text-3xl font-bold text-slate-900">{formatBRL(displayPrice)}<span className="text-base font-normal text-slate-400"> / {product.unit || 'un'}</span></p>
                <button type="button" onClick={() => { setListDialogOpen(true); loadLists(); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                  {savedListIds.length > 0 ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                  {savedListIds.length > 0 ? `Salvo em ${savedListIds.length} lista${savedListIds.length > 1 ? 's' : ''}` : 'Salvar em listas'}
                </button>
              </div>

              {hasVariants && <div className="mt-5"><Select value={variantId} onValueChange={setVariantId}><SelectTrigger className="h-11"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger><SelectContent>{variants.map(v => <SelectItem key={v.id} value={v.id}>{v.name} — {formatBRL(v.price)}</SelectItem>)}</SelectContent></Select></div>}

              <div className="mt-auto border-t border-slate-100 pt-6">
                <p className="mb-2 text-sm text-slate-400"></p>
                {unavailable ? <span className="block rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-400">{isPaused ? 'Indisponível no momento' : 'Indisponível'}</span> : cartQty > 0 ? (
                  <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700"><span className="sm:hidden">{cartQty} und</span><span className="hidden sm:inline">{cartQty} {cartQty === 1 ? 'unidade' : 'unidades'}</span></span>
                    <button type="button" onClick={handleDecrease} className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">{cartQty <= step ? <Trash2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}</button>
                    <button type="button" onClick={handleIncrease} disabled={cartQty + step > maxAvailable} className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-30"><Plus className="h-5 w-5" /></button>
                  </div>
                ) : <Button onClick={handleAdd} disabled={hasVariants && !selectedVariant} className="h-12 w-full bg-slate-900 text-base hover:bg-slate-800">Adicionar ao carrinho</Button>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Salvar em listas</DialogTitle></DialogHeader>
          {listsLoading ? <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" /></div> : lists.length === 0 ? <p className="py-5 text-sm text-slate-500">Você ainda não criou nenhuma lista.</p> : <div className="space-y-2">{lists.map(list => { const saved = savedListIds.includes(list.id); return <button key={list.id} type="button" onClick={() => toggleList(list)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${saved ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}><span><span className="block font-medium text-slate-800">{list.name}</span><span className="text-xs text-slate-400">{saved ? 'Este produto está nesta lista' : 'Adicionar produto'}</span></span>{saved ? <Check className="h-5 w-5 text-emerald-600" /> : <Plus className="h-5 w-5 text-slate-400" />}</button>; })}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="sm:max-w-lg p-0 bg-transparent border-none shadow-none">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-contain rounded-xl" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
