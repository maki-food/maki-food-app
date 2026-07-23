import React, { useState, useMemo, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { base44 } from '@/api/supabaseClient';
import { formatBRL } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Trash2, Package, Star, Heart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProductCard({ product, promoPrice, variants = [] }) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [variantId, setVariantId] = useState(variants[0]?.id || '');
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(user => base44.entities.Favorite.filter({ user_id: user.id, product_id: product.id }))
      .then(rows => {
        if (rows && rows[0]) { setIsFavorite(true); setFavoriteId(rows[0].id); }
      })
      .catch(() => {});
  }, [product.id]);

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    try {
      const user = await base44.auth.me();
      if (isFavorite && favoriteId) {
        await base44.entities.Favorite.delete(favoriteId);
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        const created = await base44.entities.Favorite.create({ user_id: user.id, product_id: product.id });
        setIsFavorite(true);
        setFavoriteId(created.id);
      }
    } catch {
      window.location.href = '/login';
    }
  };

  const selectedVariant = useMemo(() => variants.find(v => v.id === variantId) || null, [variants, variantId]);
  const hasVariants = variants.length > 0;

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

  return (
    <>
      <div className={`group relative bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-emerald-200 transition-all duration-300 flex flex-col ${unavailable ? 'opacity-50' : ''} ${product.is_promotion || hasDiscount ? 'ring-2 ring-amber-300' : ''}`}>
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
        <button
          type="button"
          onClick={toggleFavorite}
          className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
          aria-label={isFavorite ? 'Remover da lista' : 'Adicionar à lista'}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
        </button>
        <div className="p-4 flex flex-col flex-1">
          <button type="button" onClick={() => setDetailOpen(true)} className="text-left">
            <h3 className="font-semibold text-slate-900 leading-tight hover:text-emerald-700">{product.name}</h3>
          </button>
          {product.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
              {product.description}
              {hasLongDescription && (
                <button type="button" onClick={() => setDetailOpen(true)} className="text-emerald-600 font-medium ml-1 hover:underline">
                  ver mais
                </button>
              )}
            </p>
          )}

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
              <div className="flex items-center justify-between gap-2 w-full bg-slate-900 rounded-lg px-1 py-1">
                <button type="button" onClick={handleDecrease} className="w-8 h-8 rounded-md flex items-center justify-center text-white hover:bg-white/10">
                  {cartQty <= step ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </button>
                <span className="text-white font-semibold text-sm">{cartQty}</span>
                <button type="button" onClick={handleIncrease} disabled={cartQty + step > maxAvailable} className="w-8 h-8 rounded-md flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30">
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
          </DialogHeader>
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="aspect-square bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center w-full cursor-zoom-in"
          >
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-16 h-16 text-slate-300" />
            )}
          </button>
          {product.description && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{product.description}</p>
          )}
          <p className="text-xl font-bold text-emerald-600">{formatBRL(displayPrice)}{!hasVariants && <span className="text-sm text-slate-400 font-normal"> / {product.unit || 'un'}</span>}</p>

          {hasVariants && (
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
              <SelectContent>
                {variants.map(v => <SelectItem key={v.id} value={v.id}>{v.name} — {formatBRL(v.price)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={toggleFavorite}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 flex-shrink-0"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
              Salvar na lista
            </button>

            {unavailable ? (
              <span className="flex-1 text-sm font-medium text-slate-400 px-3 py-2.5 text-center bg-slate-50 rounded-lg">
                {isPaused ? 'Indisponível no momento' : 'Indisponível'}
              </span>
            ) : cartQty > 0 ? (
              <div className="flex-1 flex items-center justify-between gap-2 bg-slate-900 rounded-lg px-1 py-1">
                <button type="button" onClick={handleDecrease} className="w-9 h-9 rounded-md flex items-center justify-center text-white hover:bg-white/10">
                  {cartQty <= step ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </button>
                <span className="text-white font-semibold text-sm">{cartQty} unit{cartQty === 1 ? '' : 's'}</span>
                <button type="button" onClick={handleIncrease} disabled={cartQty + step > maxAvailable} className="w-9 h-9 rounded-md flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button onClick={handleAdd} disabled={hasVariants && !selectedVariant} className="flex-1 bg-slate-900 hover:bg-slate-800">
                Adicionar
              </Button>
            )}
          </div>
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
