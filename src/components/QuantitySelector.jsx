import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

export default function QuantitySelector({ value, onChange, min = 1, max, step = 1, size = 'default' }) {
  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const clamp = (v) => {
    let val = parseFloat(v) || 0;
    if (max !== undefined) val = Math.min(max, val);
    return Math.max(min, parseFloat(val.toFixed(3)));
  };

  const handleDec = () => {
    const v = parseFloat(value) || 0;
    if (v <= step || v - step < min) {
      onChange(0);
      return;
    }
    onChange(clamp(v - step));
  };

  const handleInc = () => {
    const v = parseFloat(value) || 0;
    onChange(clamp(v + step));
  };

  return (
    <div className="flex items-center gap-2 select-none">
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">
        <span className="sm:hidden">{value} und</span>
        <span className="hidden sm:inline">{value} {Number(value) === 1 ? 'unidade' : 'unidades'}</span>
      </span>
      <button
        type="button"
        onClick={handleDec}
        style={{ touchAction: 'manipulation' }}
        className={`${btnSize} rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors flex-shrink-0`}
      >
        {(parseFloat(value) || 0) <= step ? <Trash2 className={iconSize} /> : <Minus className={iconSize} />}
      </button>
      <button
        type="button"
        onClick={handleInc}
        style={{ touchAction: 'manipulation' }}
        className={`${btnSize} rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-700 transition-colors flex-shrink-0`}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}