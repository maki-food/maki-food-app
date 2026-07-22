import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import OrderAccordion from '@/components/OrderAccordion';
import { logAction } from '@/lib/audit';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ClipboardList, Search, Filter, X } from 'lucide-react';

const filters = [
  { value: 'all', label: 'Todos' },
  { value: 'Pedido Emitido', label: 'Pedido Emitido' },
  { value: 'Saiu para Entrega', label: 'Saiu para Entrega' },
  { value: 'Finalizado', label: 'Finalizado' },
];

const dateFilters = [
  { value: 'all', label: 'Tudo' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [cnpjSearch, setCnpjSearch] = useState('');
  const [nfSearch, setNfSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  const load = async () => {
    try { setOrders(await base44.entities.Order.list('-created_date', 200)); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe((event) => {
      setOrders(prev => {
        if (event.type === 'create' && !prev.some(o => o.id === event.data.id)) return [event.data, ...prev];
        if (event.type === 'update') return prev.map(o => o.id === event.data.id ? { ...o, ...event.data } : o);
        if (event.type === 'delete') return prev.filter(o => o.id !== event.id);
        return prev;
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    if (filter === 'Finalizado') {
      setShowAdvanced(true);
    } else {
      setShowAdvanced(false);
    }
  }, [filter]);

  const handleDelete = async (order) => {
    if (!confirm(`Excluir pedido de ${order.restaurant_name}?`)) return;
    await base44.entities.Order.delete(order.id);
    await logAction('Pedido Excluído', order.restaurant_name);
  };

  const hasAdvancedFilter = dateStart || dateEnd || clientSearch || cnpjSearch || nfSearch;

  const clearAdvanced = () => {
    setDateStart(''); setDateEnd(''); setClientSearch(''); setCnpjSearch(''); setNfSearch('');
  };

  let filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (dateFilter !== 'all') {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = filtered.filter(o => {
      const d = new Date(o.created_date);
      if (dateFilter === 'today') return d >= startOfDay;
      if (dateFilter === 'week') return d >= startOfWeek;
      if (dateFilter === 'month') return d >= startOfMonth;
      return true;
    });
  }

  if (filter === 'Finalizado' && hasAdvancedFilter) {
    filtered = filtered.filter(o => {
      if (dateStart || dateEnd) {
        const orderDate = new Date(o.created_date);
        if (dateStart && orderDate < new Date(dateStart)) return false;
        if (dateEnd) {
          const end = new Date(dateEnd);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) return false;
        }
      }
      if (clientSearch && !o.restaurant_name?.toLowerCase().includes(clientSearch.toLowerCase())) return false;
      if (cnpjSearch && !(o.restaurant_cnpj || '').includes(cnpjSearch)) return false;
      if (nfSearch && !(o.invoice_number || '').toLowerCase().includes(nfSearch.toLowerCase())) return false;
      return true;
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
        <p className="text-sm text-slate-500">{orders.length} pedidos no total • atualização em tempo real</p>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filters.map(f => {
          const count = f.value === 'all' ? orders.length : orders.filter(o => o.status === f.value).length;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-4">
        {dateFilters.map(f => {
          const active = dateFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {showAdvanced && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Filtros Avançados</span>
            </div>
            {hasAdvancedFilter && (
              <button onClick={clearAdvanced} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Data Inicial</Label>
              <DateInput value={dateStart} onChange={v => setDateStart(v)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Final</Label>
              <DateInput value={dateEnd} onChange={v => setDateEnd(v)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Nome do Cliente</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input placeholder="Restaurante..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" value={cnpjSearch} onChange={e => setCnpjSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Nota Fiscal</Label>
              <Input placeholder="Número da NF" value={nfSearch} onChange={e => setNfSearch(e.target.value)} className="mt-1" />
            </div>
          </div>
          {hasAdvancedFilter && (
            <p className="text-xs text-slate-400 mt-3">{filtered.length} resultado(s) encontrado(s)</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <ClipboardList className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div>
          {filtered.map(order => (
            <OrderAccordion key={order.id} order={order} onUpdate={load} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}