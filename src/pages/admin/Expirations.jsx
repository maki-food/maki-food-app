import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { formatDate } from '@/lib/format';
import { AlertTriangle, Calendar, Package, CheckCircle, XCircle, CalendarClock } from 'lucide-react';

export default function Expirations() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();
  const thresholdDays = settings?.expiration_threshold_days || 7;

  const load = async () => {
    try { setBatches(await base44.stock.listBatchesWithProduct()); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.ProductBatch.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(dateStr);
    exp.setHours(0, 0, 0, 0);
    return Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  };

  const withDate = batches.filter(b => b.expiration_date);
  const withoutDate = batches.filter(b => !b.expiration_date);

  const expired = withDate.filter(b => getDaysUntil(b.expiration_date) < 0);
  const expiringSoon = withDate.filter(b => {
    const d = getDaysUntil(b.expiration_date);
    return d >= 0 && d <= thresholdDays;
  });
  const onTrack = withDate.filter(b => getDaysUntil(b.expiration_date) > thresholdDays);

  const getStatus = (b) => {
    const days = getDaysUntil(b.expiration_date);
    if (days === null) return { label: 'Sem validade', color: 'text-slate-400', bg: 'bg-slate-50', icon: Calendar };
    if (days < 0) return { label: 'Vencido', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle };
    if (days <= thresholdDays) return { label: `${days} dia(s)`, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle };
    return { label: `${days} dias`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle };
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  const cards = [
    { label: 'Vencidos', value: expired.length, icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
    { label: `Vencendo (${thresholdDays}d)`, value: expiringSoon.length, icon: AlertTriangle, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'No Prazo', value: onTrack.length, icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
    { label: 'Sem Validade', value: withoutDate.length, icon: Calendar, bg: 'bg-slate-50', color: 'text-slate-500' },
  ];

  const sortedWithDate = [...withDate].sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-emerald-600" /> Validades
        </h1>
        <p className="text-sm text-slate-500">Controle de validade por lote de compra • atualização em tempo real</p>
      </div>

      {expired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{expired.length} {expired.length === 1 ? 'lote vencido' : 'lotes vencidos'}</strong> — remova do estoque imediatamente.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {sortedWithDate.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <CalendarClock className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum lote com data de validade</p>
          <p className="text-sm mt-1">Informe a validade ao lançar uma Compra para acompanhar os vencimentos por lote</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
                <th className="px-4 py-3">Validade do Lote</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 hidden sm:table-cell">Qtd. neste lote</th>
              </tr>
            </thead>
            <tbody>
              {sortedWithDate.map(b => {
                const status = getStatus(b);
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={b.id}
                    onClick={() => b.product_id && navigate(`/admin/estoque?highlight=${b.product_id}`)}
                    className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-300" />
                        </div>
                        <p className="font-medium text-slate-900 text-sm">{b.product?.name || '(produto removido)'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500">{b.product?.category || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(b.expiration_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.color} ${status.bg} px-2 py-1 rounded-full`}>
                        <StatusIcon className="w-3 h-3" /> {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500">{b.quantity} {b.product?.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
