import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import ProductCard from '@/components/ProductCard';
import { Package, Search, Star, ChevronDown, ArrowLeft, Flame, ShoppingBag } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import CategoryCarousel from '@/components/client/CategoryCarousel';
import BannerCarousel from '@/components/client/BannerCarousel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ClientProducts() {
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); // 'home' | 'catalog'
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [categoryList, setCategoryList] = useState([]);
  const { settings } = useSettings();

  const load = async () => {
    try {
      const [prods, promos, cats, variants] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.Promotion.list('-created_date'),
        base44.entities.Category.list(),
        base44.entities.ProductVariant.list('sort_order'),
      ]);
      setProducts(prods);
      setPromotions(promos.filter(p => p.active));
      setCategoryList(cats);
      const grouped = {};
      for (const v of variants) {
        if (!grouped[v.product_id]) grouped[v.product_id] = [];
        grouped[v.product_id].push(v);
      }
      setVariantsByProduct(grouped);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsubP = base44.entities.Product.subscribe(() => load());
    const unsubPr = base44.entities.Promotion.subscribe(() => load());
    const unsubC = base44.entities.Category.subscribe(() => load());
    const unsubV = base44.entities.ProductVariant.subscribe(() => load());
    return () => { if (unsubP) unsubP(); if (unsubPr) unsubPr(); if (unsubC) unsubC(); if (unsubV) unsubV(); };
  }, []);

  const publishedProducts = products.filter(p => (p.price || 0) > 0);
  const highlightProducts = publishedProducts.filter(p => p.is_promotion && (p.stock_quantity || 0) > 0 && p.available !== false);
  const activePromos = promotions.filter(pr => {
    const prod = products.find(p => p.id === pr.product_id);
    return prod && (prod.stock_quantity || 0) > 0 && prod.available !== false;
  });
  const categories = ['all', ...categoryList.map(c => c.name)];

  const filtered = publishedProducts.filter(p => {
    const matchCat = category === 'all' || p.category === category;
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const promoProductMap = new Map(activePromos.map(pr => [pr.product_id, pr]));

  const goHome = () => { setView('home'); setCategory('all'); setSearch(''); };
  const goCatalog = () => { setCategory('all'); setView('catalog'); };
  const selectCategory = (cat) => { setCategory(cat); setView('catalog'); setShowCatDropdown(false); };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  // HOME VIEW: only highlights and promotions
  if (view === 'home') {
    const hasContent = highlightProducts.length > 0 || activePromos.length > 0;
    return (
      <div>
          {settings?.banners && settings.banners.length > 0 ? (
          <BannerCarousel banners={settings.banners} interval={settings.banner_interval || 5} />
        ) : settings?.hero_image_url ? (
          <div className="relative rounded-2xl overflow-hidden mb-6 aspect-[16/9] sm:aspect-[3/1]">
            <img src={settings.hero_image_url} alt="Banner promocional" className="w-full h-full object-cover" loading="eager" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end justify-center pb-6 sm:pb-8">
              <Button onClick={goCatalog} size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 text-base font-semibold shadow-lg">
                <ShoppingBag className="w-5 h-5 mr-2" /> Ver Produtos
              </Button>
            </div>
          </div>
        ) : null}

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Produtos</h1>

        <CategoryCarousel categories={categoryList} products={publishedProducts} onSelect={selectCategory} />

        {activePromos.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-bold text-slate-900">Promoções do Dia</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activePromos.map(promo => {
                const prod = products.find(p => p.id === promo.product_id);
                if (!prod) return null;
                return <ProductCard key={promo.id} product={prod} promoPrice={promo.promotional_price} variants={variantsByProduct[prod.id] || []} />;
              })}
            </div>
          </div>
        )}

        {highlightProducts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h2 className="text-lg font-bold text-slate-900">Destaques</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {highlightProducts.map(product => (
                <ProductCard key={product.id} product={product} variants={variantsByProduct[product.id] || []} />
              ))}
            </div>
          </div>
        )}

        {!hasContent && (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">Nenhum destaque ou promoção no momento</p>
          </div>
        )}
      </div>
    );
  }

  // CATALOG VIEW: full product list
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={goHome} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {category === 'all' ? 'Todos os Produtos' : category}
          </h1>
          <p className="text-sm text-slate-500">{filtered.length} produto(s)</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCatDropdown(!showCatDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 w-full sm:w-auto justify-between"
          >
            {category === 'all' ? 'Todas as Categorias' : category}
            <ChevronDown className={`w-4 h-4 transition-transform ${showCatDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showCatDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCatDropdown(false)} />
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[180px] max-h-64 overflow-y-auto">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => selectCategory(cat)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${category === cat ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-slate-600'}`}
                  >
                    {cat === 'all' ? 'Ver Tudo' : cat}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(product => {
            const promo = promoProductMap.get(product.id);
            return <ProductCard key={product.id} product={product} promoPrice={promo?.promotional_price} variants={variantsByProduct[product.id] || []} />;
          })}
        </div>
      )}
    </div>
  );
}