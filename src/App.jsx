import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { base44 } from '@/api/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientLayout from '@/components/client/ClientLayout';
import CartOverlay from '@/components/client/CartOverlay';
import Dashboard from '@/pages/admin/Dashboard';
import Products from '@/pages/admin/Products';
import Stock from '@/pages/admin/Stock';
import Purchases from '@/pages/admin/Purchases';
import Orders from '@/pages/admin/Orders';
import Settings from '@/pages/admin/Settings';
import Categories from '@/pages/admin/Categories';
import VariantTypes from '@/pages/admin/VariantTypes';
import FichaTecnica from '@/pages/admin/FichaTecnica';
import Expirations from '@/pages/admin/Expirations';
import Deliveries from '@/pages/admin/Deliveries';
import Promotions from '@/pages/admin/Promotions';
import ClientProducts from '@/pages/client/ClientProducts';
import Cart from '@/pages/client/Cart';
import MyOrders from '@/pages/client/MyOrders';
import ClientCategories from '@/pages/client/Categories';
import SearchView from '@/pages/client/SearchView';
import Lists from '@/pages/client/Lists';
import Account from '@/pages/client/Account';
import CatalogView from '@/pages/client/CatalogView';
import { CartProvider } from '@/context/CartContext';
import { SettingsProvider } from '@/context/SettingsContext';

function GlobalOrderRealtimeAlerts() {
  const notifiedOrderIdsRef = useRef([]);

  useEffect(() => {
    const playOrderSound = () => {
      try {
        const audio = new Audio('/order-alert-makifood.mp3');
        audio.volume = 0.7;
        void audio.play().catch(() => {
          // navegador pode bloquear play automático sem interação prévia
          // do usuário na aba — não tem o que fazer nesse caso, ignora.
        });
      } catch {
        // ignore
      }
    };

    const unsub = base44.entities.Order.subscribe((event) => {
      const order = event?.data;
      if (!order || !order.id) return;
      if (event.type !== 'create') return;

      const now = Date.now();
      notifiedOrderIdsRef.current = notifiedOrderIdsRef.current.filter(([, ts]) => now - ts < 60000);
      const alreadyNotified = notifiedOrderIdsRef.current.some(([id]) => id === order.id);
      if (alreadyNotified) return;

      if (order.status === 'Finalizado') return;
      notifiedOrderIdsRef.current.push([order.id, now]);

      playOrderSound();
      toast({
        title: 'Novo Pedido!',
        description: `${order.restaurant_name || 'Cliente'} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.total || 0))}`,
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authChecked } = useAuth();
  const location = useLocation();

  // Só mostra a tela de carregamento na primeiríssima checagem — nunca mais
  // depois disso (evita reiniciar páginas, como no fluxo de recuperação de
  // senha, toda vez que o app rechecar a sessão em segundo plano)
  if (!authChecked && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const backgroundLocation = location.state && location.state.backgroundLocation ? location.state.backgroundLocation : null;

  return (
    <>
      <GlobalOrderRealtimeAlerts />
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Home />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/produtos" element={<Products />} />
          <Route path="/admin/estoque" element={<Stock />} />
          <Route path="/admin/compras" element={<Purchases />} />
          <Route path="/admin/pedidos" element={<Orders />} />
          <Route path="/admin/configuracoes" element={<Settings />} />
          <Route path="/admin/categorias" element={<Categories />} />
          <Route path="/admin/variacoes" element={<VariantTypes />} />
          <Route path="/admin/promocoes" element={<Promotions />} />
          <Route path="/admin/ficha-tecnica" element={<FichaTecnica />} />
          <Route path="/admin/validades" element={<Expirations />} />
          <Route path="/admin/entregas" element={<Deliveries />} />
        </Route>
        <Route element={<ClientLayout />}>
          <Route path="/loja" element={<ClientProducts />} />
          <Route path="/loja/produtos" element={<CatalogView />} />
          <Route path="/loja/categorias" element={<ClientCategories />} />
          <Route path="/loja/buscar" element={<SearchView />} />
          <Route path="/loja/listas" element={<Lists />} />
          <Route path="/loja/conta" element={<Account />} />
          <Route path="/loja/carrinho" element={<Cart />} />
          <Route path="/loja/finalizar-pedido" element={<Cart />} />
          <Route path="/loja/pedidos" element={<MyOrders />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route path="/loja/carrinho" element={<CartOverlay />} />
        </Routes>
      )}
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <SettingsProvider>
            <CartProvider>
              <AuthenticatedApp />
            </CartProvider>
          </SettingsProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
