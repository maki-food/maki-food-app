import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';
import { ChevronRight } from 'lucide-react';

/**
 * Carrossel horizontal de produtos (Novos Produtos / Promoções).
 * Mostra no máximo 10 itens; se houver mais, aparece "Ver mais" que leva
 * pra listagem completa (via `seeMoreHref`).
 */
export default function ProductCarousel({ title, icon: Icon, items, variantsByProduct = {}, promoMap, seeMoreHref }) {
  if (!items || items.length === 0) return null;
  const visible = items.slice(0, 10);
  const hasMore = items.length > 10;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <Link to={seeMoreHref || '#'} className="flex items-center gap-2 group">
          {Icon && <Icon className="w-5 h-5 text-emerald-600" />}
          <h2 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700">{title}</h2>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
        </Link>
        {hasMore && seeMoreHref && (
          <Link to={seeMoreHref} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex-shrink-0">
            Ver mais
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hidden snap-x snap-mandatory">
        {visible.map(product => (
          <div key={product.id} className="w-44 sm:w-52 flex-shrink-0 snap-start">
            <ProductCard
              product={product}
              promoPrice={promoMap?.get(product.id)?.promotional_price}
              variants={variantsByProduct[product.id] || []}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
