import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import ProductCard from '@/components/ProductCard';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function SearchView() {
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  const updatePromotionList = (event) => {
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

  const updateVariantList = (event) => {
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
    const load = async () => {
      try {
        const [prods, promos, variants] = await Promise.all([
          base44.entities.Product.list(),
          base44.entities.Promotion.list(),
          base44.entities.ProductVariant.list('sort_order'),
        ]);
        setProducts(prods);
        setPromotions(promos.filter(p => p.active));
        const grouped = {};
        for (const v of variants) {
          if (!grouped[v.product_id]) grouped[v.product_id] = [];
          grouped[v.product_id].push(v);
        }
        setVariantsByProduct(grouped);
      } catch {}
      setLoading(false);
    };

    load();
    const unsubP = base44.entities.Product.subscribe(updateProductList);
    const unsubPr = base44.entities.Promotion.subscribe(updatePromotionList);
    const unsubV = base44.entities.ProductVariant.subscribe(updateVariantList);
    return () => { if (unsubP) unsubP(); if (unsubPr) unsubPr(); if (unsubV) unsubV(); };
  }, []);

  const promoMap = new Map(promotions.map(pr => [pr.product_id, pr]));
  const publishedProducts = products.filter(p => (p.price || 0) > 0);
  const results = search
    ? publishedProducts.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input
          autoFocus
          placeholder="O que você está procurando?"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-12 text-base"
        />
      </div>

      {!search ? (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Digite pra buscar um produto</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum produto encontrado pra "{search}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map(product => (
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
