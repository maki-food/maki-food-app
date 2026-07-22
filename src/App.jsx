import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientLayout from '@/components/client/ClientLayout';
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
import { CartProvider } from '@/context/CartContext';
import { SettingsProvider } from '@/context/SettingsContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // Don't redirect for auth_required - allow public browsing of the store
  }

  // Render the main app
  return (
    <Routes>
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
        <Route path="/loja/carrinho" element={<Cart />} />
        <Route path="/loja/pedidos" element={<MyOrders />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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