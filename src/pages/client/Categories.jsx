import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, Layers } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

export default function Categories() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = searchParams.get('categoria') || '';
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadCategories = () => base44.entities.Category.list('name').then(setCategories).catch(() => {});

  useEffect(() => {
    loadCategories().finally(() => setLoading(false));
    const unsub = base44.entities.Category.subscribe(() => loadCategories());
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    if (!categoryQuery || categories.length === 0) return;
    const matched = categories.find(c => c.name === categoryQuery);
    if (matched) {
      setSelectedCategory(matched);
    }
  }, [categoryQuery, categories]);

  useEffect(() => {
    if (!selectedCategory) {
      setProducts([]);
      return;
    }

    setLoadingProducts(true);
    base44.entities.Product.filter({ category: selectedCategory.name })
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedCategory]);

  // Prevent the document body from scrolling on desktop so only the two column scrolls are visible
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(min-width:1024px)');
    const apply = (mql) => {
      try {
        document.body.style.overflow = mql.matches ? 'hidden' : '';
      } catch (e) {
        // ignore
      }
    };
    apply(mq);
    const handler = (e) => apply(e.currentTarget || e);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      try { document.body.style.overflow = ''; } catch (e) {}
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const parents = categories.filter(c => !c.parent_category_id);
  const childrenOf = (id) => categories.filter(c => c.parent_category_id === id);
  const showLoadingCategories = loading && parents.length === 0;

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setSearchParams({ categoria: cat.name });
  };

  return (
    <div className="lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
      <div className="lg:grid lg:grid-cols-[20rem_1fr] lg:gap-6 lg:h-full">
        {/* Left sidebar */}
        <aside className="w-full">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto pr-2 no-scrollbar">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Categorias</h1>
            {showLoadingCategories ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            ) : parents.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Layers className="w-12 h-12 mx-auto mb-3" />
                <p className="font-medium">Nenhuma categoria cadastrada</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {parents.map(cat => {
                  const children = childrenOf(cat.id);
                  const hasChildren = children.length > 0;
                  const isOpen = expanded.has(cat.id);
                  return (
                    <div key={cat.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasChildren) toggleExpand(cat.id);
                          handleSelectCategory(cat);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-4 text-left ${selectedCategory?.id === cat.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                          {cat.image_url ? <img src={cat.image_url} alt="" className="w-full h-full object-cover" /> : <Layers className="w-5 h-5 text-slate-300" />}
                        </div>
                        <span className="flex-1 font-medium text-slate-900">{cat.name}</span>
                        {hasChildren ? (
                          isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      {hasChildren && isOpen && (
                        <div className="bg-slate-50">
                          {children.map(child => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleSelectCategory(child)}
                              className={`w-full flex items-center gap-3 pl-14 pr-4 py-3 text-left border-t border-slate-100 ${selectedCategory?.id === child.id ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
                            >
                              <span className="flex-1 text-sm font-medium text-slate-700">{child.name}</span>
                              <ChevronRight className="w-4 h-4 text-slate-300" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right content */}
        <main className="mt-6 lg:mt-0 lg:h-full lg:overflow-y-auto lg:pr-2 no-scrollbar">
          {selectedCategory ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedCategory.name}</h2>
                  <p className="text-sm text-slate-500">Produtos nesta categoria</p>
                </div>
                <span className="text-sm text-slate-400">{products.length} produto(s)</span>
              </div>

              {loadingProducts ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
              ) : products.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="font-medium">Nenhum produto encontrado nesta categoria</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map(product => (
                    <ProductCard key={product.id} product={product} variants={[]} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              <p className="font-semibold text-slate-900 mb-2">Selecione uma categoria</p>
              <p>Toque em qualquer categoria à esquerda para ver os produtos sem sair da página.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
