import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BannerCarousel({ banners = [], interval = 5 }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % count);
    }, Math.max(2, interval) * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [count, interval]);

  if (count === 0) return null;

  const go = (dir) => {
    setCurrent(prev => (prev + dir + count) % count);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 aspect-[500/375] sm:aspect-[3/1] group">
      {banners.map((url, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <img src={url} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
        </div>
      ))}

      {count > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full shadow-md flex items-center justify-center text-slate-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full shadow-md flex items-center justify-center text-slate-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/50 w-2'}`}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}