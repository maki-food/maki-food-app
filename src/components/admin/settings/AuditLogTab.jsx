import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatDate } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { ScrollText, Search, User } from 'lucide-react';

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    try { setLogs(await base44.entities.AuditLog.list('-created_date', 200)); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.AuditLog.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const filtered = logs.filter(l =>
    !search ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{logs.length} registros de auditoria</p>
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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