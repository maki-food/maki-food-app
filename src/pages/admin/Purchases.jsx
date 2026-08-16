import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL, formatDateShort } from '@/lib/format';
import { getPeriodRange } from '@/lib/dateFilters';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/date-input';
import PurchaseForm from '@/components/admin/PurchaseForm';
import { Plus, ShoppingCart, FileText, ChevronDown, ChevronUp, Search, Pencil, Trash2, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [visibleCount, setVisibleCount] = useState(20);
  const [photoView, setPhotoView] = useState(null);

  const load = async () => {
    try { setPurchases(await base44.entities.Purchase.list('-created_date', 200)); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Purchase.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, dateFrom, dateTo, periodFilter]);

  const handleDelete = async (purchase) => {
    if (!confirm(`Excluir compra de ${purchase.supplier_name}?\nO estoque será ajustado automaticamente.`)) return;
    try {
      const batches = await base44.entities.ProductBatch.filter({ purchase_id: purchase.id });
      const affectedProductIds = new Set(batches.map(b => b.product_id));
      
      // Quando um lote é deletado, o trigger SQL (recompute_product_stock) dispara
      // automaticamente e recalcula o estoque. NÃO precisa chamar adjustProductStock!
      for (const batch of batches) {
        await base44.entities.ProductBatch.delete(batch.id);
      }
      
      await base44.entities.Purchase.delete(purchase.id);
      
      for (const productId of affectedProductIds) {
        await base44.stock.refreshProductCost(productId).catch(() => {});
      }
      await logAction('Compra Excluída', `${purchase.supplier_name} - NF: ${purchase.invoice_number}`);
      load();
    } catch (err) {
      alert('Erro ao excluir compra: ' + (err.message || 'tente novamente'));
    }
  };

  const now = new Date();
  const parsePurchaseDate = (value) => {
    if (!value) return null;
    const iso = String(value).slice(0, 10);
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };
  const { start: periodStart, end: periodEnd } = getPeriodRange(periodFilter);

  const filtered = purchases.filter(p => {
    const purchaseDate = parsePurchaseDate(p.date);
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    const supplierName = String(p.supplier_name || '').toLocaleLowerCase('pt-BR');
    const invoiceNumber = String(p.invoice_number || '').toLocaleLowerCase('pt-BR');
    const matchSearch = !normalizedSearch || supplierName.includes(normalizedSearch) || invoiceNumber.includes(normalizedSearch);
    const matchPeriod = !periodStart || (purchaseDate && purchaseDate >= periodStart && purchaseDate <= periodEnd);
    const fromDate = parsePurchaseDate(dateFrom);
    const toDate = parsePurchaseDate(dateTo);
    const matchFrom = !fromDate || (purchaseDate && purchaseDate >= fromDate);
    const matchTo = !toDate || (purchaseDate && purchaseDate <= toDate);
    return matchPeriod && matchSearch && matchFrom && matchTo;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras de Fornecedores</h1>
          <p className="text-sm text-slate-500">{filtered.length} compras encontradas • atualização em tempo real</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Nova Compra
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por fornecedor ou NF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mês</option>
            <option value="all">Todos os períodos</option>
          </select>
          <DateInput value={dateFrom} onChange={v => setDateFrom(v)} className="w-auto" />
          <span className="text-slate-400 text-sm">até</span>
          <DateInput value={dateTo} onChange={v => setDateTo(v)} className="w-auto" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhuma compra encontrada</p>
          <p className="text-sm mt-1">Clique em "Nova Compra" para registrar</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map(purchase => (
              <div key={purchase.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <button
                    onClick={() => setExpanded(expanded === purchase.id ? null : purchase.id)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{purchase.supplier_name}</p>
                      <p className="text-xs text-slate-500">NF: {purchase.invoice_number} • {formatDateShort(purchase.date)}</p>
                    </div>
                    <p className="font-bold text-slate-900 hidden sm:block">{formatBRL(purchase.total)}</p>
                    {expanded === purchase.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditing(purchase); setFormOpen(true); }}
                      className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(purchase)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expanded === purchase.id && (
                  <div className="border-t border-slate-100 p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400">
                          <th className="pb-2">Produto</th>
                          <th className="pb-2 text-center">Qtd</th>
                          <th className="pb-2 text-right">Preço</th>
                          <th className="pb-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(purchase.products || []).map((item, i) => (
                          <tr key={i} className="border-t border-slate-50">
                            <td className="py-2">{item.product_name}</td>
                            <td className="py-2 text-center">
                              {item.box_weight && item.box_count ? (
                                <div>
                                  <span className="text-xs text-slate-400">{item.box_count}cx × {item.box_weight}kg</span>
                                  <div>{item.quantity}</div>
                                </div>
                              ) : (
                                <span>{item.quantity}</span>
                              )}
                            </td>
                            <td className="py-2 text-right">{formatBRL(item.price)}</td>
                            <td className="py-2 text-right">{formatBRL((item.price || 0) * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end pt-3 mt-2 border-t border-slate-50">
                      <span className="text-sm text-slate-500 mr-3">Total</span>
                      <span className="font-bold text-slate-900">{formatBRL(purchase.total)}</span>
                    </div>
                    {purchase.invoice_photo_url && (
                      <div className="mt-3 pt-3 border-t border-slate-50">
                        <p className="text-xs text-slate-400 mb-2">Foto da Nota Fiscal</p>
                        <button
                          onClick={() => setPhotoView(purchase.invoice_photo_url)}
                          className="relative group"
                        >
                          <img src={purchase.invoice_photo_url} alt="Nota Fiscal" className="h-20 rounded-lg border border-slate-200 object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg flex items-center justify-center transition-colors">
                            <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-6">
              <Button variant="outline" onClick={() => setVisibleCount(visibleCount + 20)}>
                Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      <PurchaseForm
        purchase={editing}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={load}
      />

      <Dialog open={!!photoView} onOpenChange={(o) => !o && setPhotoView(null)}>
        <DialogContent className="sm:max-w-2xl p-2">
          <DialogTitle className="sr-only">Foto da Nota Fiscal</DialogTitle>
          {photoView && <img src={photoView} alt="Nota Fiscal" className="w-full h-auto rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}