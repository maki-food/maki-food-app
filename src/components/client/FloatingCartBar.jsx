import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { formatBRL } from '@/lib/format';
import { ShoppingCart } from 'lucide-react';

export default function FloatingCartBar() {
  const { count, total } = useCart();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const hiddenRoutes = ['/loja/carrinho', '/loja/finalizar-pedido', '/loja/conta'];
  if (count === 0 || hiddenRoutes.includes(location.pathname)) return null;

  return (
    <div
      className="floating-cart-bar fixed left-4 right-4 z-40 max-w-7xl mx-auto sm:left-6 sm:right-6"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
    >
      <button
        onClick={() => navigate('/loja/carrinho', { state: { backgroundLocation: location } })}
        className="w-full rounded-2xl shadow-lg flex items-center justify-between px-5 py-3.5 transition-colors"
        style={{ backgroundColor: settings?.cart_card_bg || '#059669', color: settings?.cart_card_text || '#ffffff' }}
      >
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 flex-shrink-0" />
          <div className="text-left leading-tight">
            <p className="font-semibold text-sm">{count} {count === 1 ? 'unidade' : 'unidades'}</p>
            <p className="text-xs opacity-80">Custo estimado {formatBRL(total)}</p>
          </div>
        </div>
        <span className="font-bold text-sm px-4 py-2 rounded-xl" style={{ backgroundColor: settings?.cart_button_bg || '#ffffff', color: settings?.cart_button_text || '#047857' }}>Ver carrinho</span>
      </button>
    </div>
  );
}
