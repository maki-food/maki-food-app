import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import ProductCard from '@/components/ProductCard';
import { Package, Search, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CatalogView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('categoria') || '';
  const isPromocoes = searchParams.get('promocoes') === '1';
  const isNovos = searchParams.get('novos') === '1';

  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('busca') || '');

  const handleProductEvent = (event) => {
    setProducts(prev => {
      if (!event?.data) return prev;
      const item = event.data;
      if (event.type === 'create') return [item, ...prev];
      if (event.type === 'update') return prev.map(p => p.id === item.id ? { ...p, ...item } : p);
      if (event.type === 'delete') return prev.filter(p => p.id !== event.id);
      return prev;
    });
  };

  const handlePromotionEvent = (event) => {
    setPromotions(prev => {
      if (!event?.data) return prev;
      const item = event.data;
      if (event.type === 'create') return item.active ? [item, ...prev] : prev;
      if (event.type === 'update') {
        const updated = prev.map(p => p.id === item.id ? { ...p, ...item } : p);
        if (item.active) return prev.some(p => p.id === item.id) ? updated : [item, ...prev];
        return updated.filter(p => p.id !== item.id);
      }
      if (event.type === 'delete') return prev.filter(p => p.id !== event.id);
      return prev;
    });
  };

  const handleVariantEvent = (event) => {
    setVariantsByProduct(prev => {
      if (!event?.data) return prev;
      const variant = event.data;
      const next = { ...prev };
      if (event.type === 'delete') {
        next[variant.product_id] = (next[variant.product_id] || []).filter(v => v.id !== event.id);
        return next;
      }
      const group = [...(next[variant.product_id] || [])];
      const index = group.findIndex(v => v.id === variant.id);
      if (index !== -1) group[index] = variant;
      else group.push(variant);
      next[variant.product_id] = group;
      return next;
    });
  };

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list(),
      base44.entities.Promotion.list(),
      base44.entities.ProductVariant.list('sort_order'),
    ]).then(([prods, promos, variants]) => {
      setProducts(prods);
      setPromotions(promos.filter(p => p.active));
      const grouped = {};
      for (const v of variants) {
        if (!grouped[v.product_id]) grouped[v.product_id] = [];
        grouped[v.product_id].push(v);
      }
      setVariantsByProduct(grouped);
    }).catch(() => {}).finally(() => setLoading(false));

    const unsubP = base44.entities.Product.subscribe(handleProductEvent);
    const unsubPr = base44.entities.Promotion.subscribe(handlePromotionEvent);
    const unsubV = base44.entities.ProductVariant.subscribe(handleVariantEvent);

    return () => { if (unsubP) unsubP(); if (unsubPr) unsubPr(); if (unsubV) unsubV(); };
  }, []);

  const publishedProducts = products.filter(p => (p.price || 0) > 0);
  const promoMap = new Map(promotions.map(pr => [pr.product_id, pr]));
  const showLoadingSpinner = loading && products.length === 0;

  let filtered = publishedProducts;
  if (isPromocoes) {
    filtered = filtered.filter(p => promoMap.has(p.id));
  } else if (isNovos) {
    filtered = filtered.filter(p => p.is_new);
  } else if (category) {
    filtered = filtered.filter(p => p.category === category);
  }
  if (search) {
    filtered = filtered.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  }

  const title = isPromocoes ? 'Promoções' : isNovos ? 'Novos Produtos' : (category || 'Todos os Produtos');

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{filtered.length} produto(s)</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {showLoadingSpinner ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(product => (
            <ProductCard
              key={product.id} product={product}
              promoPrice={promoMap.get(product.id)?.promotional_price}
              variants={variantsByProduct[product.id] || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
