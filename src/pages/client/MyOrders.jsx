import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL, formatDate, getOrderDisplayItems, getOrderItemQuantityLabel, getOrderItemSubtotal } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import AuthModal from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { ClipboardList, Package, LogIn, ChevronDown, ChevronUp } from 'lucide-react';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [selectedTab, setSelectedTab] = useState('active');

  const load = async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);

    try {
      const u = await base44.auth.me();
      setUser(u);
      const restaurants = await base44.entities.Restaurant.filter({ user_id: u.id }).catch(() => []);
      const restaurant = restaurants[0];
      const allOrders = await base44.entities.Order.list('-created_date', 200);
      const matchesCustomer = (order) => (
        order.created_by_id === u.id
        || (restaurant?.restaurant_name && order.restaurant_name === restaurant.restaurant_name)
        || (restaurant?.cnpj && order.restaurant_cnpj === restaurant.cnpj)
      );
      setOrders((allOrders || []).filter(matchesCustomer));
    } catch {
      setUser(null);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    load();

    // REMOVIDO: existia aqui um setInterval fazendo essa mesma busca
    // (user + restaurant + orders — 3 requisições) A CADA 1 SEGUNDO,
    // rodando JUNTO com o realtime abaixo, que já faz a mesma coisa de
    // forma orientada a evento. Isso sozinho explica o "3 fetches
    // idênticos em sequência" que aparece no Network — em 1 segundo esse
    // polling roda de novo, empilhando com o realtime. É carga desnecessária
    // no banco e não tem nenhuma vantagem sobre o realtime (que já é
    // instantâneo). Não reintroduza polling aqui.
    const unsub = base44.entities.Order.subscribe((event) => {
      if (event.type === 'refresh' || event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        load({ silent: true });
        return;
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (!user && !loading) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Faça login para ver seus pedidos</h2>
        <p className="text-sm text-slate-500 mb-4">Acompanhe o status dos seus pedidos aqui</p>
        <Button onClick={() => setShowAuth(true)} className="bg-emerald-600 hover:bg-emerald-700">Entrar / Cadastrar</Button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => window.location.reload()} />
      </div>
    );
  }

  const sortByDeliverySequence = (a, b) => {
    if (a.delivery_sequence == null && b.delivery_sequence == null) {
      return new Date(b.created_date) - new Date(a.created_date);
    }
    if (a.delivery_sequence == null) return 1;
    if (b.delivery_sequence == null) return -1;
    return Number(a.delivery_sequence) - Number(b.delivery_sequence);
  };

  const active = orders.filter(o => o.status !== 'Finalizado').sort(sortByDeliverySequence);
  const finalized = orders.filter(o => o.status === 'Finalizado').sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const ordersToShow = selectedTab === 'active' ? active : finalized;
  const showLoadingOrders = loading && !user;

  const getDeliverySequenceMessage = (order) => {
    if (!order.delivery_sequence) return null;
    const deliveryAccepted = ['Aceito', 'Saiu para Entrega', 'Finalizado'].includes(order.delivery_status)
      || ['Saiu para Entrega', 'Finalizado'].includes(order.status);
    if (!deliveryAccepted) return null;
    if (order.status === 'Saiu para Entrega') {
      return `Entrega em rota — sua ordem está na posição ${order.delivery_sequence} da sequência.`;
    }
    if (order.status === 'Finalizado') {
      return `Entrega concluída — sua ordem estava na posição ${order.delivery_sequence} da sequência.`;
    }
    return `Ordem recebida pelo entregador — posição ${order.delivery_sequence} na sequência de entrega.`;
  };

  const renderOrder = (order) => {
    const isExpanded = expanded === order.id;
    const sequenceMessage = getDeliverySequenceMessage(order);
    return (
      <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
        <button
          onClick={() => setExpanded(isExpanded ? null : order.id)}
          className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 truncate">{order.invoice_number || `Pedido #${order.id?.slice(-6).toUpperCase()}`}</p>
            <p className="text-xs text-slate-500">{formatDate(order.created_date)} • {(order.items || []).length} itens</p>
            {sequenceMessage && <p className="text-xs text-emerald-600 mt-1 truncate">{sequenceMessage}</p>}
          </div>
          <StatusBadge status={order.status} />
          <p className="font-bold text-slate-900 hidden sm:block">{formatBRL(order.total)}</p>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {isExpanded && (
          <div className="border-t border-slate-100 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-400 text-xs">Endereço</p><p className="text-slate-700">{order.delivery_address}</p></div>
              <div><p className="text-slate-400 text-xs">Pagamento</p><p className="text-slate-700">{order.payment_method_2 ? `${order.payment_method} + ${order.payment_method_2}` : order.payment_method}</p></div>
              {order.observations && <div className="sm:col-span-2"><p className="text-slate-400 text-xs">Observações</p><p className="text-slate-700">{order.observations}</p></div>}
            </div>
            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-400 text-left">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-center">Qtd</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {getOrderDisplayItems(order).map((item, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-3 py-2">{item.product_name}{item.variant_name ? ` - ${item.variant_name}` : ''}</td>
                      <td className="px-3 py-2 text-center">{getOrderItemQuantityLabel(item)}</td>
                      <td className="px-3 py-2 text-right">{formatBRL(getOrderItemSubtotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Frete</span>
              <span>{(order.shipping_fee || 0) > 0 ? formatBRL(order.shipping_fee) : 'Grátis'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-lg font-bold text-emerald-600">{formatBRL(order.total)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Meus Pedidos</h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedTab('active')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedTab === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Pedidos em andamento
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('finalized')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedTab === 'finalized' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Pedidos concluídos
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {selectedTab === 'active'
            ? `${active.length} pedido(s) em andamento`
            : `${finalized.length} pedido(s) concluído(s)`}
        </p>
      </div>

      {showLoadingOrders ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <ClipboardList className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Você ainda não fez nenhum pedido</p>
          <p className="text-sm mt-1">Navegue pelo catálogo e faça seu primeiro pedido</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ordersToShow.length > 0 ? (
            ordersToShow.map(renderOrder)
          ) : (
            <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
              <ClipboardList className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">
                {selectedTab === 'active'
                  ? 'Nenhum pedido em andamento no momento'
                  : 'Nenhum pedido concluído ainda'}
              </p>
              <p className="text-sm mt-1">Volte sempre que precisar acompanhar seus pedidos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}