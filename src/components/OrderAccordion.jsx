import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL, formatDate, printOrder } from '@/lib/format';
import { useSettings } from '@/context/SettingsContext';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Printer, Trash2, Pencil, MapPin, CreditCard, Phone, MessageSquare, Upload, Check, X, FileText, Maximize2 } from 'lucide-react';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export default function OrderAccordion({ order, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(order.items || []);
  const [uploading, setUploading] = useState(false);
  const [deliverers, setDeliverers] = useState([]);
  const [photoViewOpen, setPhotoViewOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedDeliverer, setSelectedDeliverer] = useState(order.deliverer_id || 'none');

  useEffect(() => { setItems(order.items || []); }, [order.items]);
  useEffect(() => { setSelectedDeliverer(order.deliverer_id || 'none'); }, [order.deliverer_id]);

  useEffect(() => {
    base44.entities.User.list().then(users => {
      setDeliverers(users.filter(u => u.role === 'deliverer'));
    }).catch(() => {});
    base44.entities.Product.list().then(setProducts).catch(() => {});
  }, []);

  const saveItems = async () => {
    const numericItems = items.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 }));
    const subtotal = numericItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
    const total = subtotal + (order.shipping_fee || 0);
    await base44.entities.Order.update(order.id, { items: numericItems, total });
    await logAction('Itens do Pedido Editados', `${order.restaurant_name} - ${numericItems.length} itens`);
    setEditing(false);
    onUpdate?.();
  };

  const deleteItem = async (idx) => {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
    const numericItems = newItems.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 }));
    const subtotal = numericItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
    const total = subtotal + (order.shipping_fee || 0);
    await base44.entities.Order.update(order.id, { items: numericItems, total });
    await logAction('Item Removido do Pedido', `${order.restaurant_name} - ${items[idx]?.product_name}`);
    onUpdate?.();
  };

  const changeStatus = async (status) => {
    if (status === 'Finalizado' && order.status !== 'Finalizado') {
      const prods = await base44.entities.Product.list();
      for (const item of (order.items || [])) {
        const product = prods.find(p => p.name === item.product_name);
        if (product) {
          const deductQty = (item.weight_kg != null && item.weight_kg !== '') ? parseFloat(item.weight_kg) : (parseFloat(item.quantity) || 0);
          await base44.stock.deductFefo({ productId: product.id, quantity: deductQty });
          await base44.entities.InventoryWriteOff.create({
            product_name: item.product_name,
            product_id: product.id,
            quantity: deductQty,
            reason: 'Venda',
            notes: `Pedido ${order.invoice_number || order.id}${item.variant_name ? ` (${item.variant_name})` : ''}`,
          });
        }
      }
    }
    await base44.entities.Order.update(order.id, {
      status,
      ...(status === 'Finalizado' ? { delivery_completed_at: new Date().toISOString() } : {}),
    });
    await logAction('Status do Pedido Alterado', `${order.restaurant_name}: ${order.status} → ${status}`);
    onUpdate?.();
  };

  const assignDeliverer = async (delivererId) => {
    const previousDeliverer = selectedDeliverer;
    setSelectedDeliverer(delivererId || 'none');
    const deliverer = deliverers.find(d => d.id === delivererId);
    const updates = {
      deliverer_id: delivererId,
      deliverer_name: deliverer?.full_name || deliverer?.email || '',
      delivery_status: 'Pendente',
      status: 'Em Separação',
    };
    try {
      await base44.entities.Order.update(order.id, updates);
      await logAction('Entregador Atribuído', `${order.restaurant_name}: ${deliverer?.full_name || deliverer?.email || 'Removido'}`);
      onUpdate?.();
    } catch (error) {
      setSelectedDeliverer(previousDeliverer);
      alert(error?.message || 'Não foi possível atualizar o entregador.');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Order.update(order.id, { delivery_photo_url: file_url });
      onUpdate?.();
    } catch {}
    setUploading(false);
  };

  const itemCount = (order.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);

  const { settings } = useSettings();

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{order.restaurant_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-slate-700">{order.invoice_number || 'Sem NF'}</span> • {formatDate(order.created_date)} • {itemCount} {itemCount === 1 ? 'item' : 'itens'} • {formatBRL(order.total)}
          </p>
        </div>
        <StatusBadge status={order.status} />
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">Endereço de Entrega</p><p className="text-slate-700">{order.delivery_address}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <CreditCard className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">Forma de Pagamento</p><p className="text-slate-700">{order.payment_method}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">Contato</p><p className="text-slate-700">{order.contact_info || '-'}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-slate-400 text-xs">Observações</p><p className="text-slate-700">{order.observations || '-'}</p></div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 bg-slate-50">
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 text-center">Qtd</th>
                  <th className="px-3 py-2">Código de Barras</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  {editing && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {(editing ? items : order.items || []).map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-50">
                    <td className="px-3 py-2">{item.product_name}{item.variant_name ? ` - ${item.variant_name}` : ''}</td>
                    <td className="px-3 py-2 text-center">
                      {editing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => {
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it));
                            }}
                            className="w-16 text-center border border-slate-200 rounded px-1 py-0.5"
                          />
                          <span className="text-xs text-slate-400 whitespace-nowrap">{products.find(p => p.name === item.product_name)?.unit || ''}</span>
                        </div>
                      ) : (
                        <span>{item.quantity} {products.find(p => p.name === item.product_name)?.unit || ''}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{item.barcode || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      {(() => {
                        const f = formatBRL((item.price || 0) * item.quantity);
                        const num = f.replace('R$', '').replace(/\u00A0/g, ' ').trim();
                        return (
                          <span className="inline-flex items-center justify-end w-full">
                            <span className="text-slate-700 mr-1">R$</span>
                            <span className="font-mono tabular-nums text-right" style={{minWidth: 64}}>{num}</span>
                          </span>
                        );
                      })()}
                    </td>
                    {editing && (
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => deleteItem(idx)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm py-2 border-t border-slate-100">
            <span className="text-slate-500">Subtotal: <strong className="text-slate-700"><span className="inline-flex items-center"><span className="text-slate-700 mr-1">R$</span><span className="font-mono tabular-nums" style={{minWidth:64}}>{formatBRL((editing ? items : order.items || []).reduce((s, i) => s + (i.price || 0) * (parseFloat(i.quantity) || 0), 0)).replace('R$', '').replace(/\u00A0/g, ' ').trim()}</span></span></strong></span>
            {(order.shipping_fee || 0) > 0 && (
              <span className="text-slate-500">Frete: <strong className="text-slate-700">{order.shipping_fee ? (<span className="inline-flex items-center"><span className="text-slate-700 mr-1">R$</span><span className="font-mono tabular-nums" style={{minWidth:64}}>{formatBRL(order.shipping_fee).replace('R$', '').replace(/\u00A0/g, ' ').trim()}</span></span>) : 'Grátis'}</strong></span>
            )}
            <span className="text-slate-500">Total: <strong className="text-emerald-600"><span className="inline-flex items-center"><span className="text-slate-700 mr-1">R$</span><span className="font-mono tabular-nums" style={{minWidth:64}}>{formatBRL((editing ? items : order.items || []).reduce((s, i) => s + (i.price || 0) * (parseFloat(i.quantity) || 0), 0) + (order.shipping_fee || 0)).replace('R$', '').replace(/\u00A0/g, ' ').trim()}</span></span></strong></span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 h-9 bg-slate-50 rounded-lg border border-slate-200">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{order.invoice_number || 'Sem NF'}</span>
            </div>
            <Select defaultValue={order.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pedido Emitido">Pedido Emitido</SelectItem>
                <SelectItem value="Em Separação">Em Separação</SelectItem>
                <SelectItem value="Com Entregador">Com Entregador</SelectItem>
                <SelectItem value="Saiu para Entrega">Saiu para Entrega</SelectItem>
                <SelectItem value="Finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">Entregador:</span>
              <Select
                value={selectedDeliverer}
                onValueChange={(v) => assignDeliverer(v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Atribuir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem entregador</SelectItem>
                  {deliverers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name || d.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {order.deliverer_name && order.delivery_status === 'Aceito' && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">
                Entrega aceita por {order.deliverer_name}
              </span>
            )}
            {order.deliverer_name && order.delivery_status === 'Saiu para Entrega' && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full whitespace-nowrap">
                Saiu para entrega — {order.deliverer_name}
              </span>
            )}
            {order.deliverer_name && order.delivery_status === 'Finalizado' && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">
                Entrega finalizada por {order.deliverer_name}
              </span>
            )}
            {order.deliverer_name && order.delivery_status === 'Pendente' && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">
                Pendente — {order.deliverer_name}
              </span>
            )}

            {editing ? (
              <>
                <Button onClick={saveItems} size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9">
                  <Check className="w-4 h-4 mr-1" /> Salvar Itens
                </Button>
                <Button onClick={() => { setEditing(false); setItems(order.items || []); }} variant="outline" size="sm" className="h-9">
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)} variant="outline" size="sm" className="h-9">
                <Pencil className="w-4 h-4 mr-1" /> Editar Itens
              </Button>
            )}

            <Button onClick={() => printOrder(order, settings)} variant="outline" size="sm" className="h-9">
              <Printer className="w-4 h-4 mr-1" /> Imprimir 2 Vias
            </Button>

            <label className="inline-flex items-center gap-1.5 px-3 h-9 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Foto Comprovante'}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>

            {order.delivery_photo_url && (
              <button
                onClick={() => setPhotoViewOpen(true)}
                className="relative group"
                title="Ver comprovante em tela cheia"
              >
                <img src={order.delivery_photo_url} alt="Comprovante" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg flex items-center justify-center transition-colors">
                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            )}

            <Dialog open={photoViewOpen} onOpenChange={(o) => setPhotoViewOpen(o)}>
              <DialogContent className="sm:max-w-2xl p-2">
                <DialogTitle className="sr-only">Comprovante de Entrega</DialogTitle>
                {order.delivery_photo_url && (
                  <img src={order.delivery_photo_url} alt="Comprovante de entrega" className="w-full h-auto rounded-lg" />
                )}
                <div className="text-center text-sm text-slate-500 pb-2 pt-1">
                  Comprovante — {order.restaurant_name} • {order.invoice_number || 'Sem NF'}
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => onDelete(order)}
              variant="outline"
              size="sm"
              className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Excluir Pedido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}