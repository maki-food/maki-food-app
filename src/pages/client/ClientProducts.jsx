import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Package, Sparkles, Flame, ShoppingBag } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import BannerCarousel from '@/components/client/BannerCarousel';
import ProductCarousel from '@/components/client/ProductCarousel';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function ClientProducts() {
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [prods, promos, variants] = await Promise.all([
        base44.entities.Product.list('-created_date'),
        base44.entities.Promotion.list('-created_date'),
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

  useEffect(() => {
    load();
    const unsubP = base44.entities.Product.subscribe(() => load());
    const unsubPr = base44.entities.Promotion.subscribe(() => load());
    const unsubV = base44.entities.ProductVariant.subscribe(() => load());
    return () => { if (unsubP) unsubP(); if (unsubPr) unsubPr(); if (unsubV) unsubV(); };
  }, []);

  const publishedProducts = products.filter(p => (p.price || 0) > 0);
  const newProducts = [...publishedProducts].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const activePromos = promotions.filter(pr => {
    const prod = products.find(p => p.id === pr.product_id);
    return prod && (prod.price || 0) > 0;
  });
  const promoMap = new Map(activePromos.map(pr => [pr.product_id, pr]));
  const promoProducts = activePromos.map(pr => products.find(p => p.id === pr.product_id)).filter(Boolean);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  const hasContent = newProducts.length > 0 || promoProducts.length > 0;

  return (
    <div>
      {settings?.banners && settings.banners.length > 0 ? (
        <BannerCarousel banners={settings.banners} interval={settings.banner_interval || 5} />
      ) : settings?.hero_image_url ? (
        <div className="relative rounded-2xl overflow-hidden mb-6 aspect-[16/9] sm:aspect-[3/1]">
          <img src={settings.hero_image_url} alt="Banner promocional" className="w-full h-full object-cover" loading="eager" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end justify-center pb-6 sm:pb-8">
            <Button onClick={() => navigate('/loja/categorias')} size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 text-base font-semibold shadow-lg">
              <ShoppingBag className="w-5 h-5 mr-2" /> Ver Produtos
            </Button>
          </div>
        </div>
      ) : null}

      <ProductCarousel
        title="Promoções"
        icon={Flame}
        items={promoProducts}
        variantsByProduct={variantsByProduct}
        promoMap={promoMap}
        seeMoreHref="/loja/produtos?promocoes=1"
      />

      <ProductCarousel
        title="Novos Produtos"
        icon={Sparkles}
        items={newProducts}
        variantsByProduct={variantsByProduct}
        seeMoreHref="/loja/produtos"
      />

      {!hasContent && (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum produto disponível no momento</p>
        </div>
      )}
    </div>
  );
}
