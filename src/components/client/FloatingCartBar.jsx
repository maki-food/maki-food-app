import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { formatBRL } from '@/lib/format';
import { ShoppingCart } from 'lucide-react';

export default function FloatingCartBar() {
  const { count, total } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  if (count === 0 || location.pathname === '/loja/carrinho' || location.pathname === '/loja/conta') return null;

  return (
    <div
      className="fixed left-4 right-4 z-40 max-w-7xl mx-auto sm:left-6 sm:right-6"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
    >
      <button
        onClick={() => navigate('/loja/carrinho')}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg flex items-center justify-between px-5 py-3.5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 flex-shrink-0" />
          <div className="text-left leading-tight">
            <p className="font-semibold text-sm">{count} {count === 1 ? 'unidade' : 'unidades'}</p>
            <p className="text-xs text-emerald-100">Custo estimado {formatBRL(total)}</p>
          </div>
        </div>
        <span className="font-semibold text-sm bg-white/15 px-4 py-2 rounded-xl">Ver carrinho</span>
      </button>
    </div>
  );
}
