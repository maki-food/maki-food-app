import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { formatBRL } from '@/lib/format';
import { ShoppingCart } from 'lucide-react';

export default function FloatingCartBar() {
  const { count, total } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  if (count === 0 || location.pathname === '/loja/carrinho') return null;

  return (
    <div
      className="fixed left-4 right-4 z-40 max-w-7xl mx-auto sm:left-6 sm:right-6"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
    >
      <button
        onClick={() => navigate('/loja/carrinho')}
        className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-2xl shadow-lg flex items-stretch overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 flex-1">
          <ShoppingCart className="w-6 h-6 flex-shrink-0" />
          <div className="text-left leading-tight">
            <p className="font-bold text-sm">{count} {count === 1 ? 'unidade' : 'unidades'}</p>
            <p className="text-xs opacity-80">Custo estimado {formatBRL(total)}</p>
          </div>
        </div>
        <div className="flex items-center px-5 bg-slate-900 text-white font-semibold text-sm">
          Ver carrinho
        </div>
      </button>
    </div>
  );
}
