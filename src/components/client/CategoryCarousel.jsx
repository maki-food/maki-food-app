import React, { useRef } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

export default function CategoryCarousel({ categories, products, onSelect }) {
  const scrollRef = useRef(null);
  const { settings } = useSettings();

  const items = categories.map(cat => ({
    name: cat.name,
    image_url: cat.image_url || null,
  }));

  const displayItems = items.length > 0 ? [...items, ...items] : [];

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || displayItems.length === 0) return;
    const halfWidth = el.scrollWidth / 2;
    if (el.scrollLeft >= halfWidth) {
      el.scrollLeft -= halfWidth;
    }
  };

  const scrollByAmount = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const firstItem = el.querySelector('button');
    const itemWidth = firstItem ? firstItem.offsetWidth : 200;
    const gap = 12;
    el.scrollBy({ left: direction * (itemWidth + gap), behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <div className="mb-8" style={{
      backgroundColor: settings?.category_bar_bg || 'transparent',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
      paddingLeft: 'calc(50vw - 50%)',
      paddingRight: 'calc(50vw - 50%)',
    }}>
      <div className="px-4 sm:px-6 py-4">
      <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
        Arrasta para o lado <span className="text-slate-300">&rarr;</span>
      </p>
      <div className="relative">
        <button
          onClick={() => scrollByAmount(-1)}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto pb-2 no-scrollbar"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {displayItems.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelect(item.name)}
              className="flex-shrink-0 w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] snap-start group"
            >
              <div className="aspect-square overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <Package className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
              <p className="text-center text-sm font-semibold text-slate-900 mt-2 truncate">{item.name}</p>
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollByAmount(1)}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200"
          aria-label="Próximo"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      </div>
    </div>
  );
}