import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { ChevronRight, ChevronDown, Layers } from 'lucide-react';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const navigate = useNavigate();

  const load = () => base44.entities.Category.list('name').then(setCategories).catch(() => {});

  useEffect(() => {
    load().finally(() => setLoading(false));
    const unsub = base44.entities.Category.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const parents = categories.filter(c => !c.parent_category_id);
  const childrenOf = (id) => categories.filter(c => c.parent_category_id === id);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const goToCategory = (name) => navigate(`/loja/produtos?categoria=${encodeURIComponent(name)}`);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Categorias</h1>
      {parents.length === 0 ? (
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
                  onClick={() => hasChildren ? toggleExpand(cat.id) : goToCategory(cat.name)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left"
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
                        onClick={() => goToCategory(child.name)}
                        className="w-full flex items-center gap-3 pl-14 pr-4 py-3 hover:bg-slate-100 text-left border-t border-slate-100"
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
  );
}
