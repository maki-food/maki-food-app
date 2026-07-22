import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSettings } from '@/context/SettingsContext';
import { useCart } from '@/context/CartContext';
import { Fish, ShoppingCart } from 'lucide-react';
import BackToTop from '@/components/BackToTop';
import BottomNav from '@/components/client/BottomNav';
import FloatingCartBar from '@/components/client/FloatingCartBar';
import AccountPromptModal from '@/components/client/AccountPromptModal';

export default function ClientLayout() {
  const location = useLocation();
  const { count } = useCart();
  const { settings } = useSettings();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-slate-200" style={{ backgroundColor: settings?.topbar_bg || '#ffffff', color: settings?.store_text_color || '#475569' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/loja" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
              {settings?.logo_url ? <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <Fish className="w-5 h-5 text-white" />}
            </div>
            <span className="font-bold text-lg">{settings?.app_name || 'SushiPro'}</span>
          </Link>
          <Link
            to="/loja/carrinho"
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === '/loja/carrinho' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-black/5'}`}
          >
            <ShoppingCart className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <Outlet />
      </main>

      <BackToTop />
      <FloatingCartBar />
      <AccountPromptModal />
      <BottomNav />
    </div>
  );
}
