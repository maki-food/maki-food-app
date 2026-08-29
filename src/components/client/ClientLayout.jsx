import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '@/context/SettingsContext';
import { useCart } from '@/context/CartContext';
import { Fish, ShoppingCart, Search, LayoutGrid } from 'lucide-react';
import ListIcon from '@/components/client/ListIcon';
import BackToTop from '@/components/BackToTop';
import BottomNav from '@/components/client/BottomNav';
import FloatingCartBar from '@/components/client/FloatingCartBar';
import AccountPromptModal from '@/components/client/AccountPromptModal';
import DesktopAccountMenu from '@/components/client/DesktopAccountMenu';
import { formatBRL } from '@/lib/format';

export default function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { count, total } = useCart();
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const isCartRoute = location.pathname === '/loja/carrinho';

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/loja/produtos?busca=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b border-slate-200"
        style={{ backgroundColor: settings?.topbar_bg || '#ffffff', color: settings?.store_text_color || '#475563' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link to="/loja" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: settings?.primary_color || '#059669' }}>
                {settings?.logo_url ? <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <Fish className="w-5 h-5 text-white" />}
              </div>
              <span className="font-bold text-lg whitespace-nowrap">{settings?.app_name || 'Maki Food - Tudo Para Seu Restaurante'}</span>
            </Link>

            <form onSubmit={handleSearch} className="hidden lg:flex flex-shrink-0 w-[22rem]">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar produtos"
                  className="w-full h-9 pl-9 pr-3 rounded-full bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </form>
          </div>

          <nav className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <Link to="/loja/categorias" className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-black/5">
              <LayoutGrid className="w-4 h-4" /> Categorias
            </Link>
            <Link to="/loja/listas" className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-black/5">
              <ListIcon className="w-4 h-4" /> Listas
            </Link>
          </nav>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden lg:block">
              <DesktopAccountMenu />
            </div>

            <Link
              to="/loja/carrinho"
              state={{ backgroundLocation: location }}
              className="relative flex items-center gap-2 px-3 lg:px-4 h-10 rounded-full font-semibold text-sm flex-shrink-0"
              style={{ backgroundColor: (settings?.primary_color || '#059669') + '1a', color: settings?.primary_color || '#059669' }}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="lg:hidden absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center" style={{ display: count > 0 ? 'flex' : 'none' }}>
                {count}
              </span>
              {count > 0 && <span className="hidden lg:inline">{count} · {formatBRL(total)}</span>}
            </Link>
          </div>
        </div>

        {/* Busca compacta no mobile, embaixo do cabeçalho */}
        <form onSubmit={handleSearch} className="lg:hidden px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produtos"
              className="w-full h-10 pl-9 pr-3 rounded-full bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </form>
      </header>

      {isCartRoute && <button type="button" aria-label="Fechar carrinho" onClick={() => navigate(-1)} className="fixed inset-0 z-[55] hidden bg-slate-950/35 lg:block" />}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 ${isCartRoute ? 'lg:fixed lg:right-0 lg:top-0 lg:z-[56] lg:mx-0 lg:h-full lg:w-[min(94vw,520px)] lg:max-w-none lg:overflow-y-auto lg:bg-white lg:shadow-2xl' : ''}`}>
        <Outlet />
      </main>

      <BackToTop />
      <div className="lg:hidden">
        <FloatingCartBar />
      </div>
      <AccountPromptModal />
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
