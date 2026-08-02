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
  const [isDesktop, setIsDesktop] = useState(true);
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const updateIsDesktop = (event) => setIsDesktop(event.matches);
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateIsDesktop);
    return () => mediaQuery.removeEventListener('change', updateIsDesktop);
  }, []);

  const desktopBanners = settings?.desktop_banners?.length > 0 ? settings.desktop_banners : settings?.banners || [];
  const mobileBanners = settings?.mobile_banners?.length > 0 ? settings.mobile_banners : desktopBanners;
  const banners = isDesktop ? desktopBanners : mobileBanners;

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
    const unsubP = base44.entities.Product.subscribe(updateProductList);
    const unsubPr = base44.entities.Promotion.subscribe(updatePromotionList);
    const unsubV = base44.entities.ProductVariant.subscribe(updateVariantList);
    return () => { if (unsubP) unsubP(); if (unsubPr) unsubPr(); if (unsubV) unsubV(); };
  }, []);

  const publishedProducts = products.filter(p => (p.price || 0) > 0);
  const newProducts = publishedProducts.filter(p => p.is_new);
  const activePromos = promotions.filter(pr => {
    const prod = products.find(p => p.id === pr.product_id);
    return prod && (prod.price || 0) > 0;
  });
  const promoMap = new Map(activePromos.map(pr => [pr.product_id, pr]));
  const promoProducts = activePromos.map(pr => products.find(p => p.id === pr.product_id)).filter(Boolean);
  const hasContent = newProducts.length > 0 || promoProducts.length > 0;
  const hasBanners = banners.length > 0;
  const showLoadingSpinner = loading && !hasContent;

  return (
    <div>
      {hasBanners ? (
        <BannerCarousel banners={banners} interval={settings?.banner_interval || 5} />
      ) : (settings?.hero_image_mobile_url || settings?.hero_image_url) ? (
        <div className="relative rounded-2xl overflow-hidden mb-6 aspect-[16/9] sm:aspect-[3/1]">
          <picture>
            {settings.hero_image_mobile_url ? <source media="(max-width: 639px)" srcSet={settings.hero_image_mobile_url} /> : null}
            {settings.hero_image_url ? <source media="(min-width: 640px)" srcSet={settings.hero_image_url} /> : null}
            <img src={settings.hero_image_mobile_url || settings.hero_image_url} alt="Banner promocional" className="w-full h-full object-cover" loading="eager" decoding="async" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end justify-center pb-6 sm:pb-8">
            <Button onClick={() => navigate('/loja/categorias')} size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 text-base font-semibold shadow-lg">
              <ShoppingBag className="w-5 h-5 mr-2" /> Ver Produtos
            </Button>
          </div>
        </div>
      ) : null}

      {showLoadingSpinner ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : (
        <> 
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
            seeMoreHref="/loja/produtos?novos=1"
          />

          {!hasContent && (
            <div className="text-center py-16 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">Nenhum produto disponível no momento</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
