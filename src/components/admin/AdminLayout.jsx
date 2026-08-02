import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { formatBRL } from '@/lib/format';
import { toast } from '@/components/ui/use-toast';
import Sidebar from './Sidebar';
import { Menu, Bell, X } from 'lucide-react';

const adminRoles = ['admin', 'seller', 'deliverer'];

export default function AdminLayout() {
  const { settings } = useSettings();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

    const unsub = base44.entities.Order.subscribe((event) => {
      if (event.type === 'create') {
        const o = event.data;
        const isDelivererAssigned = user.role === 'deliverer' && o.deliverer_id === user.id;
        const isAdmin = user.role === 'admin' || user.role === 'seller';
        if (isAdmin || isDelivererAssigned) {
          const title = isDelivererAssigned ? 'Nova Entrega Atribuída!' : 'Novo Pedido!';
          const description = `${o.restaurant_name} • ${formatBRL(o.total)}`;
          setNotification({ title, message: description });
          playSound();
          setTimeout(() => setNotification(null), 10000);
        }
      }
      if (event.type === 'update' && user.role !== 'deliverer') {
        const o = event.data;
        if (o.delivery_status === 'Aceito' && o.deliverer_name) {
          const title = 'Entrega Aceita!';
          const description = `${o.restaurant_name} — aceita por ${o.deliverer_name}`;
          setNotification({ title, message: description });
          playSound();
          setTimeout(() => setNotification(null), 10000);
        } else if (o.delivery_status === 'Saiu para Entrega') {
          const title = 'Saiu para Entrega!';
          const description = `${o.restaurant_name} — ${o.deliverer_name || ''}`;
          setNotification({ title, message: description });
          playSound();
          setTimeout(() => setNotification(null), 10000);
        } else if (o.delivery_status === 'Finalizado' || o.status === 'Finalizado') {
          const title = 'Entrega Finalizada!';
          const description = `${o.restaurant_name}`;
          setNotification({ title, message: description });
          playSound();
          setTimeout(() => setNotification(null), 10000);
        }
      }
      if (event.type === 'update' && user.role === 'deliverer') {
        const wasAssignedToUser = event.previousData?.deliverer_id === user.id;
        const isAssignedToUser = event.data?.deliverer_id === user.id;
        if (isAssignedToUser && !wasAssignedToUser) {
          const title = 'Você recebeu uma entrega!';
          const description = `${event.data.restaurant_name} • ${formatBRL(event.data.total)}`;
          setNotification({ title, message: description });
          playSound();
          setTimeout(() => setNotification(null), 10000);
        }
      }
    });
    return () => { if (unsub) unsub(); };
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={user.role} />
      <div className="lg:ml-64">
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold">{settings?.app_name || 'SushiPro'}</span>
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