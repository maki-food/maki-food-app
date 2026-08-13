import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { formatBRL } from '@/lib/format';
import { toast } from '@/components/ui/use-toast';
import Sidebar from './Sidebar';
import { Menu, Bell, X, LogOut } from 'lucide-react';

const adminRoles = ['admin', 'seller', 'deliverer'];

export default function AdminLayout() {
  const { settings } = useSettings();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastOrderIdRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;

    const playSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const createBell = (startTime, frequency) => {
          const osc = audioContext.createOscillator();
          const fmOsc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          const filter = audioContext.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(frequency, startTime);
          osc.frequency.exponentialRampToValueAtTime(frequency * 1.08, startTime + 0.12);

          fmOsc.type = 'sine';
          fmOsc.frequency.setValueAtTime(6, startTime);

          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(frequency * 1.5, startTime);
          filter.Q.setValueAtTime(12, startTime);

          gainNode.gain.setValueAtTime(0.0001, startTime);
          gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

          osc.connect(filter);
          fmOsc.connect(osc.frequency);
          filter.connect(gainNode);
          gainNode.connect(audioContext.destination);

          osc.start(startTime);
          fmOsc.start(startTime);
          osc.stop(startTime + 0.5);
          fmOsc.stop(startTime + 0.5);
        };

        const now = audioContext.currentTime;
        createBell(now, 720);
        createBell(now + 0.45, 880);
      } catch {
        // ignore audio failures on restricted browsers
      }
    };

    const notifyOrder = (title, description, options = {}) => {
      const { playAudio = true } = options;
      setNotification({ title, message: description });
      if (playAudio) {
        playSound();
      }
      setTimeout(() => setNotification(null), 10000);
    };

    const checkLatestOrder = async () => {
      try {
        const recent = await base44.entities.Order.list('-created_date', 15);
        if (!recent?.length) return;

        const activeNewest = [...recent].find((order) => order?.status !== 'Finalizado') || recent[0];
        if (!activeNewest) return;

        if (!lastOrderIdRef.current) {
          lastOrderIdRef.current = activeNewest.id;
          return;
        }

        const trackedOrderStillExists = recent.some((order) => order?.id === lastOrderIdRef.current);
        if (!trackedOrderStillExists) {
          lastOrderIdRef.current = activeNewest.id;
          return;
        }

        if (activeNewest.id !== lastOrderIdRef.current) {
          const previousId = lastOrderIdRef.current;
          lastOrderIdRef.current = activeNewest.id;
          if (previousId && activeNewest.id && (user.role === 'admin' || user.role === 'seller')) {
            notifyOrder('Novo Pedido!', `${activeNewest.restaurant_name || 'Cliente'} • ${formatBRL(activeNewest.total || 0)}`);
          }
        }
      } catch {
        // ignore polling failures
      }
    };

    const triggerCreateNotification = (o) => {
      if (!o || !o.id || o.status === 'Finalizado') return;
      const isDelivererAssigned = user.role === 'deliverer' && o.deliverer_id === user.id;
      const isAdmin = user.role === 'admin' || user.role === 'seller';
      if ((isAdmin || isDelivererAssigned) && (!lastOrderIdRef.current || lastOrderIdRef.current !== o.id)) {
        const title = isDelivererAssigned ? 'Nova Entrega Atribuída!' : 'Novo Pedido!';
        const description = `${o.restaurant_name || 'Cliente'} • ${formatBRL(o.total || 0)}`;
        notifyOrder(title, description);
      }
      lastOrderIdRef.current = o.id;
    };

    if (user.role !== 'deliverer') {
      checkLatestOrder();
      pollingRef.current = window.setInterval(() => {
        checkLatestOrder();
      }, 4000);
    }

    const unsub = base44.entities.Order.subscribe((event) => {
      if (event.type === 'refresh') {
        if (user.role !== 'deliverer') checkLatestOrder();
        return;
      }

      if (event.type === 'create') {
        triggerCreateNotification(event.data);
      }

      if (event.type === 'delete') {
        const deletedOrder = event.data;
        const deletedLabel = deletedOrder?.restaurant_name || 'Pedido';
        if ((user.role === 'admin' || user.role === 'seller')) {
          notifyOrder('Pedido Excluído', `${deletedLabel} foi removido do sistema.`, { playAudio: false });
        }
        if (lastOrderIdRef.current === deletedOrder?.id) {
          lastOrderIdRef.current = null;
        }
      }

      if (event.type === 'update' && user.role !== 'deliverer') {
        const o = event.data;
        if (o.delivery_status === 'Aceito' && o.deliverer_name) {
          notifyOrder('Entrega Aceita!', `${o.restaurant_name} — aceita por ${o.deliverer_name}`);
        } else if (o.delivery_status === 'Saiu para Entrega') {
          notifyOrder('Saiu para Entrega!', `${o.restaurant_name} — ${o.deliverer_name || ''}`);
        } else if (o.delivery_status === 'Finalizado' || o.status === 'Finalizado') {
          notifyOrder('Entrega Finalizada!', `${o.restaurant_name}`);
        }
      }

      if (event.type === 'update' && user.role === 'deliverer') {
        const wasAssignedToUser = event.previousData?.deliverer_id === user.id;
        const isAssignedToUser = event.data?.deliverer_id === user.id;
        if (isAssignedToUser && !wasAssignedToUser) {
          notifyOrder('Você recebeu uma entrega!', `${event.data.restaurant_name} • ${formatBRL(event.data.total)}`);
        }
      }
    });

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (unsub) unsub();
    };
  }, [user]);

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
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={user.role} />
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
              <span className="font-bold">{settings?.app_name || 'SushiPro'}</span>
            </>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
      {notification && (
        <div className="fixed top-4 right-4 z-[60] bg-emerald-600 text-white p-4 rounded-xl shadow-2xl max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">{notification.title}</p>
              <p className="text-xs text-emerald-50 mt-0.5">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}