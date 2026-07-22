import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL, formatDate } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/date-input';
import { TrendingUp, ShoppingBag, Package, AlertTriangle, Store, ArrowRight, Calendar } from 'lucide-react';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const loadData = async () => {
    try {
      const [o, p, r] = await Promise.all([
        base44.entities.Order.list('-created_date', 200),
        base44.entities.Product.list(),
        base44.entities.Restaurant.list(),
      ]);
      setOrders(o); setProducts(p); setRestaurants(r);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsubO = base44.entities.Order.subscribe(() => loadData());
    const unsubP = base44.entities.Product.subscribe(() => loadData());
    return () => { if (unsubO) unsubO(); if (unsubP) unsubP(); };
  }, []);

  const presetDays = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateStart(start.toISOString().split('T')[0]);
    setDateEnd(end.toISOString().split('T')[0]);
  };

  const presetMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateStart(start.toISOString().split('T')[0]);
    setDateEnd(now.toISOString().split('T')[0]);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  const filteredOrders = orders.filter(o => {
    if (!dateStart && !dateEnd) return true;
    const orderDate = new Date(o.created_date);
    if (dateStart && orderDate < new Date(dateStart)) return false;
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      if (orderDate > end) return false;
    }
    return true;
  });

  const totalSales = filteredOrders.filter(o => o.status === 'Finalizado').reduce((s, o) => s + (o.total || 0), 0);
  const pendingOrders = filteredOrders.filter(o => o.status === 'Pedido Emitido');
  const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock || 0));
  const stockValue = products.reduce((s, p) => s + (p.price || 0) * (p.stock_quantity || 0), 0);

  const cards = [
    { label: 'Vendas Finalizadas', value: formatBRL(totalSales), icon: TrendingUp, bg: 'bg-emerald-50', color: 'text-emerald-600' },
    { label: 'Pedidos Pendentes', value: pendingOrders.length, icon: ShoppingBag, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'Produtos Cadastrados', value: products.length, icon: Package, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Alertas de Estoque', value: lowStock.length, icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-600' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Visão geral do seu negócio</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Período de Análise</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-400">Data Inicial</label>
            <DateInput value={dateStart} onChange={v => setDateStart(v)} className="mt-1 w-auto" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Data Final</label>
            <DateInput value={dateEnd} onChange={v => setDateEnd(v)} className="mt-1 w-auto" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => { setDateStart(''); setDateEnd(''); }}>Tudo</Button>
            <Button size="sm" variant="outline" onClick={() => presetDays(7)}>7 dias</Button>
            <Button size="sm" variant="outline" onClick={() => presetDays(30)}>30 dias</Button>
            <Button size="sm" variant="outline" onClick={presetMonth}>Este mês</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Pedidos Recentes</h2>
            <Link to="/admin/pedidos" className="text-sm text-emerald-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhum pedido no período selecionado</p>
          ) : (
            <div className="space-y-2">
              {filteredOrders.slice(0, 8).map(order => (
                <div key={order.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{order.restaurant_name}</p>
                    <p className="text-xs text-slate-400">{formatDate(order.created_date)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                  <p className="font-semibold text-sm text-slate-900">{formatBRL(order.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Estoque Baixo</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Tudo em ordem!</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-red-500">{p.stock_quantity} {p.unit} restante</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2"><Store className="w-4 h-4" /> Restaurantes</span>
              <span className="font-semibold text-slate-900">{restaurants.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2"><Package className="w-4 h-4" /> Valor em Estoque</span>
              <span className="font-semibold text-slate-900">{formatBRL(stockValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}