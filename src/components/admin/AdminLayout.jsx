import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import Sidebar from './Sidebar';
import { Menu, LogOut } from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

const adminRoles = ['admin', 'seller', 'deliverer'];

export default function AdminLayout() {
  const { settings } = useSettings();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);


  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !adminRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Deliverers can only access the Entregas page
  if (user.role === 'deliverer' && location.pathname !== '/admin/entregas') {
    return <Navigate to="/admin/entregas" replace />;
  }

  const routePermissions = {
    '/admin': 'dashboard',
    '/admin/produtos': 'products_view',
    '/admin/variacoes': 'variations',
    '/admin/estoque': 'stock_view',
    '/admin/compras': 'purchases',
    '/admin/categorias': 'categories',
    '/admin/promocoes': 'promotions',
    '/admin/ficha-tecnica': 'recipe',
    '/admin/validades': 'expirations',
    '/admin/pedidos': 'orders',
    '/admin/entregas': 'deliveries',
    '/admin/configuracoes': 'settings',
    '/admin/caixa': 'cash_flow',
  };
  const requiredPermission = routePermissions[location.pathname];

  const handleLogout = () => {
    const cartBackup = localStorage.getItem('cart');
    localStorage.clear();
    sessionStorage.clear();
    if (cartBackup) localStorage.setItem('cart', cartBackup);
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background">
      {user.role !== 'deliverer' && (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} userRole={user.role} />
      )}
      <div className={user.role === 'deliverer' ? '' : 'lg:ml-64'}>
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
          {user.role === 'deliverer' ? (
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-900">ENTREGADOR MAKI FOOD</span>
            </div>
          ) : (
            <>
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-bold">{settings?.app_name || 'Maki Food - Tudo Para Seu Restaurante'}</span>
            </>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </header>
        <main className="p-4 lg:p-8">
          {requiredPermission && !hasPermission(user, requiredPermission) ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <h1 className="text-xl font-semibold text-slate-900">Acesso não permitido</h1>
              <p className="mt-2 text-sm text-slate-500">Você não tem permissão para acessar esta página.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}