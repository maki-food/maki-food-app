import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL, formatDate, getOrderDisplayItems, getOrderItemQuantityLabel, getOrderItemSubtotal } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, CreditCard, Phone, Package, Camera, Truck, CheckCircle, Clock, Bike, ExternalLink } from 'lucide-react';

export default function Deliveries() {
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [completedOrders, setCompletedOrders] = useState([]);

  const isToday = (date) => {
    if (!date) return false;
    const value = new Date(date);
    const now = new Date();
    return value.getFullYear() === now.getFullYear()
      && value.getMonth() === now.getMonth()
      && value.getDate() === now.getDate();
  };

  useEffect(() => {
    let unsub;
    let syncTimer;
    let active = true;
    base44.auth.me().then(u => {
      if (!active) return;
      setUser(u);
      const load = async () => {
        try {
          const all = await base44.entities.Order.list('-created_date', 200);
          if (!active) return;
          const mine = all.filter(o => o.deliverer_id === u.id);
          setOrders(mine.filter(o => o.status !== 'Finalizado'));
          setCompletedOrders(mine.filter(o => o.status === 'Finalizado' && isToday(o.delivery_completed_at || o.updated_date || o.created_date)));
        } catch {}
        if (active) setLoading(false);
      };
      load();
      unsub = base44.entities.Order.subscribe((event) => {
        if (!active) return;
        if (event.type === 'refresh') {
          load();
          return;
        }
        if (event.type === 'update' && event.data.deliverer_id === u.id && event.data.status === 'Finalizado') {
          setOrders(prev => prev.filter(o => o.id !== event.data.id));
          setCompletedOrders(prev => [event.data, ...prev.filter(o => o.id !== event.data.id)].filter(o => isToday(o.delivery_completed_at || o.updated_date || o.created_date)));
          return;
        }
        setOrders(prev => {
          if (event.type === 'create') {
            if (event.data.deliverer_id === u.id && event.data.status !== 'Finalizado' && !prev.some(o => o.id === event.data.id)) return [event.data, ...prev];
            return prev;
          }
          if (event.type === 'update') {
            if (event.data.deliverer_id !== u.id || event.data.status === 'Finalizado') return prev.filter(o => o.id !== event.data.id);
            const alreadyListed = prev.some(o => o.id === event.data.id);
            if (!alreadyListed) return [event.data, ...prev];
            return prev.map(o => o.id === event.data.id ? { ...o, ...event.data } : o);
          }
          if (event.type === 'delete') return prev.filter(o => o.id !== event.id);
          return prev;
        });
        if (event.type === 'delete') setCompletedOrders(prev => prev.filter(o => o.id !== event.id));
      });
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; if (unsub) unsub(); };
  }, []);

  const updateDeliveryStatus = async (order, newStatus) => {
    const updates = { delivery_status: newStatus };
    if (newStatus === 'Aceito') {
      updates.status = 'Com Entregador';
    } else if (newStatus === 'Saiu para Entrega') {
      updates.status = 'Saiu para Entrega';
    } else if (newStatus === 'Finalizado') {
      if (!order.delivery_photo_url) {
        alert('É obrigatório tirar foto do comprovante assinado antes de finalizar!');
        return;
      }
      updates.status = 'Finalizado';
      updates.delivery_completed_at = new Date().toISOString();
    }
    await base44.entities.Order.update(order.id, updates);
    await logAction('Entrega Atualizada', `${order.restaurant_name}: ${newStatus}`);
  };

  const handleUpload = async (order, file) => {
    setUploading(order.id);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Order.update(order.id, { delivery_photo_url: file_url });
    } catch {}
    setUploading(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  const statusConfig = {
    'Pendente': { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Aguardando' },
    'Aceito': { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Aceito' },
    'Saiu para Entrega': { icon: Bike, color: 'text-purple-600', bg: 'bg-purple-50', label: 'A Caminho' },
    'Finalizado': { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Finalizado' },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Minhas Entregas</h1>
        <p className="text-sm text-slate-500">{orders.length} entrega(s) atribuída(s) a você</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Truck className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhuma entrega no momento</p>
          <p className="text-sm mt-1">Aguarde novos pedidos serem atribuídos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const cfg = statusConfig[order.delivery_status] || statusConfig['Pendente'];
            const StatusIcon = cfg.icon;
            const itemCount = (order.items || []).reduce((s, i) => s + i.quantity, 0);
            const canFinalize = order.delivery_photo_url && order.delivery_status === 'Saiu para Entrega';

            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{order.restaurant_name}</p>
                      <p className="text-xs text-slate-500">{formatDate(order.created_date)} • {itemCount} itens • {formatBRL(order.total)}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${cfg.bg}`}>
                      <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span>{order.delivery_address}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address || '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir no Google Maps
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>{order.contact_info || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>{order.payment_method}</span>
                    </div>
                  </div>

                  {order.observations && (
                    <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
                      <strong>Obs:</strong> {order.observations}
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> ITENS</p>
                    <div className="space-y-1">
                      {getOrderDisplayItems(order).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-700">{getOrderItemQuantityLabel(item)} {item.product_name}</span>
                          <span className="text-slate-500">{formatBRL(getOrderItemSubtotal(item))}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.delivery_photo_url && (
                    <div className="flex items-center gap-2">
                      <img src={order.delivery_photo_url} alt="Comprovante" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Comprovante anexado</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {order.delivery_status === 'Pendente' && (
                      <Button onClick={() => updateDeliveryStatus(order, 'Aceito')} className="bg-blue-600 hover:bg-blue-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Aceitar Entrega
                      </Button>
                    )}
                    {order.delivery_status === 'Aceito' && (
                      <Button onClick={() => updateDeliveryStatus(order, 'Saiu para Entrega')} className="bg-purple-600 hover:bg-purple-700">
                        <Bike className="w-4 h-4 mr-1" /> Saiu para Entrega
                      </Button>
                    )}
                    {order.delivery_status === 'Saiu para Entrega' && (
                      <Button
                        onClick={() => updateDeliveryStatus(order, 'Finalizado')}
                        disabled={!canFinalize}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Finalizar Entrega
                      </Button>
                    )}

                    <label className={`inline-flex items-center gap-1.5 px-4 h-9 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 ${uploading === order.id ? 'opacity-50' : ''}`}>
                      <Camera className="w-4 h-4" />
                      {uploading === order.id ? 'Enviando...' : order.delivery_photo_url ? 'Trocar Foto' : 'Foto Comprovante *'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(order, f); }}
                        disabled={uploading === order.id}
                      />
                    </label>

                    {order.delivery_status === 'Saiu para Entrega' && !order.delivery_photo_url && (
                      <span className="text-xs text-red-500 self-center">Foto obrigatória para finalizar</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Entregas concluídas do dia</h2>
            <p className="text-sm text-slate-500">{completedOrders.length} entrega(s) finalizada(s) hoje</p>
          </div>
        </div>

        {completedOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
            <CheckCircle className="w-9 h-9 mx-auto mb-2" />
            <p className="text-sm">Nenhuma entrega concluída hoje</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completedOrders.map(order => (
              <details key={order.id} className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-slate-50">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-slate-900 truncate">{order.restaurant_name}</span>
                    <span className="block text-xs text-slate-500">{formatDate(order.delivery_completed_at || order.updated_date || order.created_date)} • {formatBRL(order.total)}</span>
                  </span>
                  <span className="text-xs font-medium text-emerald-600">Ver detalhes</span>
                </summary>
                <div className="border-t border-slate-100 p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span>{order.delivery_address}</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address || '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir no Google Maps
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600"><CreditCard className="w-4 h-4 text-slate-400" /> {order.payment_method}</div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-400">ITENS</p>
                    {getOrderDisplayItems(order).map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{getOrderItemQuantityLabel(item)} {item.product_name}</span>
                        <span className="text-slate-500">{formatBRL(getOrderItemSubtotal(item))}</span>
                      </div>
                    ))}
                  </div>
                  {order.delivery_photo_url && <img src={order.delivery_photo_url} alt="Comprovante" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}