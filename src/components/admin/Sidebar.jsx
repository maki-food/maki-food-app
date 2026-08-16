import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { LayoutDashboard, Package, Boxes, ShoppingCart, ClipboardList, Settings, Fish, X, LogOut, Tag, Calculator, Bike, Flame, CalendarClock, Layers } from 'lucide-react';

const allMenuItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, roles: ['admin', 'seller'] },
  { label: 'Produtos', path: '/admin/produtos', icon: Package, roles: ['admin', 'seller'] },
  { label: 'Variações', path: '/admin/variacoes', icon: Layers, roles: ['admin', 'seller'] },
  { label: 'Estoque', path: '/admin/estoque', icon: Boxes, roles: ['admin', 'seller'] },
  { label: 'Compras', path: '/admin/compras', icon: ShoppingCart, roles: ['admin', 'seller'] },
  { label: 'Categorias', path: '/admin/categorias', icon: Tag, roles: ['admin', 'seller'] },
  { label: 'Promoções do Dia', path: '/admin/promocoes', icon: Flame, roles: ['admin', 'seller'] },
  { label: 'Ficha Técnica', path: '/admin/ficha-tecnica', icon: Calculator, roles: ['admin', 'seller'] },
  { label: 'Validades', path: '/admin/validades', icon: CalendarClock, roles: ['admin', 'seller'], badge: 'expiration' },
  { label: 'Pedidos', path: '/admin/pedidos', icon: ClipboardList, roles: ['admin', 'seller'], badge: 'pending' },
  { label: 'Entregas', path: '/admin/entregas', icon: Bike, roles: ['deliverer'], badge: 'delivery' },
  { label: 'Configurações', path: '/admin/configuracoes', icon: Settings, roles: ['admin'] },
];

export default function Sidebar({ open, onClose, userRole = 'admin' }) {
  const location = useLocation();
  const { settings } = useSettings();
  const [pendingCount, setPendingCount] = useState(0);
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [expirationCount, setExpirationCount] = useState(0);

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [orders, currentUser] = await Promise.all([
          base44.entities.Order.list('-created_date', 300),
          base44.auth.me().catch(() => null),
        ]);

        const pendingOrders = (orders || []).filter(o => o.status === 'Pedido Emitido');
        setPendingCount(pendingOrders.length);

        if (currentUser?.role === 'deliverer') {
          setDeliveryCount((orders || []).filter(o => o.deliverer_id === currentUser.id && o.status !== 'Finalizado').length);
        } else {
          setDeliveryCount(0);
        }
      } catch {
        setPendingCount(0);
        setDeliveryCount(0);
      }
    };

    const fetchExpirations = async () => {
      try {
        const prods = await base44.entities.Product.list();
        const appSettings = await base44.entities.AppSettings.list();
        const threshold = appSettings.length > 0 ? (appSettings[0].expiration_threshold_days || 7) : 7;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setExpirationCount(prods.filter(p => {
          if (!p.expiration_date) return false;
          const exp = new Date(p.expiration_date);
          exp.setHours(0, 0, 0, 0);
          const days = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
          return days <= threshold;
        }).length);
      } catch {
        setExpirationCount(0);
      }
    };

    fetchCounts();
    fetchExpirations();

    const intervalId = window.setInterval(() => {
      fetchCounts();
    }, 10000);

    const unsub = base44.entities.Order.subscribe(() => fetchCounts());
    const unsubProd = base44.entities.Product.subscribe(() => fetchExpirations());
    return () => {
      window.clearInterval(intervalId);
      if (unsub) unsub();
      if (unsubProd) unsubProd();
    };
  }, [userRole]);

  const badgeCount = (badge) => {
    if (badge === 'pending') return pendingCount;
    if (badge === 'delivery') return deliveryCount;
    if (badge === 'expiration') return expirationCount;
    return 0;
  };

  const handleLogout = () => {
    const cartBackup = localStorage.getItem('cart');
    localStorage.clear();
    sessionStorage.clear();
    if (cartBackup) localStorage.setItem('cart', cartBackup);
    window.location.href = '/login';
  };

  return (
    <>
      {open && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-50 transform transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`} style={{ color: settings?.admin_text_color || '#ffffff' }}>
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            {settings?.logo_url ? <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <Fish className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-tight">{settings?.app_name || 'SushiPro'}</h1>
            <p className="text-xs opacity-60">Suprimentos</p>
          </div>
          <button onClick={onClose} className="lg:hidden opacity-60 hover:opacity-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hidden">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            const bCount = item.badge ? badgeCount(item.badge) : 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-slate-800'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.badge && bCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                    {bCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100 transition-opacity w-full text-left">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}