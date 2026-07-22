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
    <button
      onClick={() => navigate('/loja/carrinho')}
      className="fixed left-4 right-4 z-40 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between max-w-7xl mx-auto sm:left-6 sm:right-6"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
    >
      <span className="flex items-center gap-2 font-semibold">
        <ShoppingCart className="w-5 h-5" />
        Ver carrinho
        <span className="bg-white/25 rounded-full px-2 py-0.5 text-xs font-bold">{count}</span>
      </span>
      <span className="font-bold">{formatBRL(total)}</span>
    </button>
  );
}
