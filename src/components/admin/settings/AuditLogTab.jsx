import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatDate } from '@/lib/format';
import { getPeriodRange } from '@/lib/dateFilters';
import { Input } from '@/components/ui/input';
import { ScrollText, Search, User, X } from 'lucide-react';

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('today');

  const load = async () => {
    try { setLogs(await base44.entities.AuditLog.list('-created_date', 200)); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.AuditLog.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const { start: periodStart, end: periodEnd } = getPeriodRange(periodFilter);
  const filtered = logs.filter(l => {
    const createdAt = l.created_date ? new Date(l.created_date) : null;
    const matchesPeriod = !periodStart || (createdAt && createdAt >= periodStart && createdAt <= periodEnd);
    const matchesAction = actionFilter === 'all' || l.action === actionFilter;
    const query = search.toLowerCase();
    const matchesSearch = !query || l.action?.toLowerCase().includes(query) || l.user_name?.toLowerCase().includes(query) || l.details?.toLowerCase().includes(query);
    return matchesPeriod && matchesAction && matchesSearch;
  });
  const actions = [...new Set(logs.map(log => log.action).filter(Boolean))].sort();
  const hasFilters = Boolean(search || actionFilter !== 'all' || periodFilter !== 'today');

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">{filtered.length} de {logs.length} registros</p>
          <p className="text-xs text-slate-400">Registros do período selecionado</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar usuário, ação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mês</option>
            <option value="all">Todos os períodos</option>
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="all">Todas as ações</option>
            {actions.map(action => <option key={action} value={action}>{action}</option>)}
          </select>
          {hasFilters && (
            <button type="button" onClick={() => { setSearch(''); setActionFilter('all'); setPeriodFilter('today'); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-3 text-sm text-slate-500 hover:bg-slate-100">
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          <ScrollText className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3 hidden sm:table-cell">Detalhes</th>
                <th className="px-4 py-3 whitespace-nowrap">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-900 truncate max-w-[120px]">{log.user_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500 max-w-xs truncate">{log.details || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(log.created_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}