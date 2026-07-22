import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

export default function QuantitySelector({ value, onChange, min = 1, max, step = 1, size = 'default' }) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const inputWidth = size === 'sm' ? 'w-12' : 'w-14';

  const clamp = (v) => {
    let val = parseFloat(v) || 0;
    if (max !== undefined) val = Math.min(max, val);
    return Math.max(min, parseFloat(val.toFixed(3)));
  };

  const handleDec = () => {
    const v = parseFloat(value) || 0;
    onChange(clamp(v - step));
  };

  const handleInc = () => {
    const v = parseFloat(value) || 0;
    onChange(clamp(v + step));
  };

  return (
    <div className="flex items-center gap-1 select-none">
      <button
        type="button"
        onClick={handleDec}
        style={{ touchAction: 'manipulation' }}
        className={`${btnSize} rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors flex-shrink-0`}
      >
        <Minus className={iconSize} />
      </button>
      <input
        type="number"
        step="any"
        min={min}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={() => onChange(clamp(inputValue))}
        className={`${inputWidth} text-center text-sm font-medium border border-slate-200 rounded px-1 py-0.5`}
      />
      <button
        type="button"
        onClick={handleInc}
        style={{ touchAction: 'manipulation' }}
        className={`${btnSize} rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-600 transition-colors flex-shrink-0`}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}