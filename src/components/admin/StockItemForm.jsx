import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ImageIcon, Printer } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { logAction } from '@/lib/audit';
import { optimizeImage } from '@/lib/imageUpload';
import { formatDateShort, formatBRL } from '@/lib/format';
import PrintBatchModal from '@/components/admin/PrintBatchModal';

const units = ['kg', 'g', 'un', 'litro', 'ml'];

const emptyForm = {
  name: '',
  unit: 'un',
  min_stock: '10',
  image_url: '',
  barcode: '',
  category: '',
  purchase_cost: '0',
  stock_quantity: '0',
};

// Formata data para YYYYMMDD
const formatDateForBatch = (dateStr) => {
  if (!dateStr) return '00000000';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  } catch {
    return '00000000';
  }
};

// Calcula número do lote baseado na posição (FEFO — lote mais antigo = 01)
const calculateBatchNumber = (batchIndex) => {
  return String(batchIndex + 1).padStart(2, '0');
};

/**
 * Cadastro/edição rápida de item no Estoque — nome, unidade real (kg/g/un/
 * litro/ml — nunca "caixa", que é só embalagem de compra), estoque mínimo e
 * foto (essa foto já vai junto quando o item for publicado em Produtos).
 * Código de barras é lançado nas Compras. SKU e NCM ficam pra Produtos.
 */
export default function StockItemForm({ item, prefill, open, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchCosts, setBatchCosts] = useState({ current: null, next: null });
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedBatchForPrint, setSelectedBatchForPrint] = useState(null);

  useEffect(() => {
    if (!open) return;
    base44.entities.Category.list().then((cats) => {
      const names = cats.map(c => c.name).filter(Boolean);
      setCategories(names.length > 0 ? names : ['Peixes', 'Arroz', 'Algas Nori', 'Molhos', 'Cream Cheese', 'Vegetais', 'Utensílios', 'Embalagens']);
    }).catch(() => {
      setCategories(['Peixes', 'Arroz', 'Algas Nori', 'Molhos', 'Cream Cheese', 'Vegetais', 'Utensílios', 'Embalagens']);
    });

    if (item) {
      base44.stock.refreshProductCost(item.id).catch(() => {});
      base44.entities.Product.get(item.id)
        .then((fresh) => {
          setForm({
            name: fresh.name || item.name || '',
            unit: fresh.unit || item.unit || 'un',
            min_stock: fresh.min_stock != null ? String(fresh.min_stock) : (item.min_stock != null ? String(item.min_stock) : '10'),
            image_url: fresh.image_url || item.image_url || '',
            barcode: fresh.barcode || item.barcode || '',
            category: fresh.category || item.category || '',
            purchase_cost: fresh.purchase_cost != null ? String(fresh.purchase_cost) : (item.purchase_cost != null ? String(item.purchase_cost) : '0'),
            stock_quantity: fresh.stock_quantity != null ? String(fresh.stock_quantity) : (item.stock_quantity != null ? String(item.stock_quantity) : '0'),
          });
        })
        .catch(() => {
          setForm({
            name: item.name || '',
            unit: item.unit || 'un',
            min_stock: item.min_stock != null ? String(item.min_stock) : '10',
            image_url: item.image_url || '',
            barcode: item.barcode || '',
            category: item.category || '',
            purchase_cost: item.purchase_cost != null ? String(item.purchase_cost) : '0',
            stock_quantity: item.stock_quantity != null ? String(item.stock_quantity) : '0',
          });
        });

      const loadBatchesWithCosts = async () => {
        try {
          const batchList = await base44.stock.listBatches(item.id);
          const enhanced = await Promise.all(batchList.map(async (batch) => {
            let batch_cost = null;
            if (batch.purchase_id) {
              const purchase = await base44.entities.Purchase.get(batch.purchase_id).catch(() => null);
              if (purchase && Array.isArray(purchase.products)) {
                const purchaseProduct = purchase.products.find((product) => product.product_id === item.id)
                  || purchase.products.find((product) => product.product_name === item.name);
                if (purchaseProduct) {
                  const parsedPrice = parseFloat(purchaseProduct.price);
                  if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
                    batch_cost = Number(parsedPrice.toFixed(2));
                  } else {
                    const quantity = parseFloat(purchaseProduct.quantity) || 0;
                    const totalCost = parseFloat(purchaseProduct.total_cost) || 0;
                    batch_cost = quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : null;
                  }
                }
              }
            }
            return { ...batch, batch_cost };
          }));

          setBatches(enhanced);
          setBatchCosts({
            current: enhanced[0]?.batch_cost ?? null,
            next: enhanced[1]?.batch_cost ?? null,
          });
          if (enhanced[0]?.batch_cost != null) {
            setForm(prev => ({ ...prev, purchase_cost: String(enhanced[0].batch_cost) }));
          }
        } catch {
          setBatches([]);
          setBatchCosts({ current: null, next: null });
        }
      };

      loadBatchesWithCosts();
    } else if (prefill) {
      setForm({
        ...emptyForm,
        name: prefill.name || '',
        barcode: prefill.barcode || '',
        unit: prefill.unit || 'un',
        category: prefill.category || '',
        purchase_cost: prefill.purchase_cost != null ? String(prefill.purchase_cost) : '0',
      });
      setBatches([]);
    } else {
      setForm(emptyForm);
      setBatches([]);
    }
  }, [open, item, prefill]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
      setForm(prev => ({ ...prev, image_url: file_url }));
    } catch {}
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        unit: form.unit,
        category: form.category || null,
        min_stock: Math.round(parseFloat(form.min_stock) || 0),
        image_url: form.image_url,
      };
      if (item) {
        await base44.entities.Product.update(item.id, {
          ...payload,
          barcode: form.barcode || null,
          purchase_cost: parseFloat(form.purchase_cost) || 0,
        });
        await logAction('Item de Estoque Editado', form.name);
      } else {
        const created = await base44.entities.Product.create({
          ...payload,
          barcode: form.barcode || null,
          purchase_cost: parseFloat(form.purchase_cost) || 0,
          price: 0,
          stock_quantity: 0,
          category: form.category || null,
          description: '',
        });
        await logAction('Item de Estoque Criado', form.name);
        onSave?.(created);
        onClose();
        setLoading(false);
        return;
      }
      onSave?.(item);
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar item', description: err.message || 'Tente novamente.' });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Excluir "${item.name}" do estoque? Isso também remove os lotes e, se estiver publicado, some da loja.`)) return;
    setLoading(true);
    try {
      await base44.entities.Product.delete(item.id);
      await logAction('Item de Estoque Excluído', item.name);
      onDelete?.();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message || 'Tente novamente.' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-full max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item de Estoque' : 'Novo Item de Estoque'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[120px_1fr] gap-4 items-start">
              <div className="w-full">
                <div className="w-28 h-28 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50">
                  {form.image_url ? <img src={form.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                </div>
              </div>
              <div className="space-y-3">
                <label className="cursor-pointer text-sm text-emerald-600 font-medium hover:text-emerald-700">
                  {uploading ? 'Enviando...' : 'Enviar foto'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                <p className="text-sm text-slate-500 max-w-xl">Adicione ou atualize a imagem do item para deixar o estoque mais profissional.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Ex: Salmão Inteiro" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Código de Barras</Label>
                <Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="mt-1" placeholder="789..." />
              </div>
              <div>
                <Label>Unidade de Estoque</Label>
                <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Custo de Compra Atual</Label>
                {item ? (
                  <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900">
                    {formatBRL(parseFloat(form.purchase_cost) || 0)}
                  </div>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    value={form.purchase_cost}
                    onChange={e => setForm({ ...form, purchase_cost: e.target.value })}
                    className="mt-1"
                    placeholder="0,00"
                  />
                )}
                {item ? (
                  <p className="text-xs text-slate-500 mt-1">Valor derivado do lote atual de compra. Muda automaticamente quando o lote atual acabar ou quando o último lote for excluído.</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Este valor será usado como custo inicial para o item de estoque.</p>
                )}
              </div>
              <div>
                <Label>Estoque Atual</Label>
                <Input disabled value={`${form.stock_quantity || '0'} ${form.unit}`} className="mt-1 bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Estoque Mínimo</Label>
                <Input type="number" step="1" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="mt-1" />
              </div>
              <div />
            </div>

            <p className="text-xs text-slate-400 max-w-2xl">Código de barras e custo são registrados via compra. Use este formulário para revisar o estoque e editar dados do item.</p>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900 mb-4">Resumo do estoque</p>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-2">Custo do lote atual</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatBRL(batchCosts.current != null ? batchCosts.current : parseFloat(form.purchase_cost) || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-2">Próximo lote</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {batchCosts.next != null ? formatBRL(batchCosts.next) : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-2">Estoque atual</p>
                  <p className="text-2xl font-semibold text-slate-900">{form.stock_quantity || '0'} {form.unit}</p>
                </div>
              </div>
            </div>

            {item && (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-900">Lotes de estoque</p>
                  <p className="text-xs text-slate-500">Organizados por validade (mais antigos primeiro) e quantidade.</p>
                </div>
                {batches.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum lote encontrado para este item.</p>
                ) : (
                  <div className="space-y-3">
                    {batches.map((batch, index) => {
                      const batchNumber = calculateBatchNumber(index);
                      const batchDate = formatDateForBatch(batch.expiration_date);
                      return (
                        <div key={batch.id} className="rounded-3xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">{batch.quantity || 0} {form.unit}</p>
                              <p className="text-xs text-slate-500">Validade <strong className="font-semibold text-slate-900">{batch.expiration_date ? formatDateShort(batch.expiration_date) : 'sem data'}</strong></p>
                              <p className="text-xs text-emerald-600 font-mono font-semibold mt-2">Lote: {batchNumber}-{batchDate}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBatchForPrint({ batchNumber, batchDate, productName: form.name });
                                setPrintModalOpen(true);
                              }}
                              className="border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 flex-shrink-0"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>

          {selectedBatchForPrint && (
            <PrintBatchModal
              open={printModalOpen}
              onClose={() => {
                setPrintModalOpen(false);
                setSelectedBatchForPrint(null);
              }}
              productName={selectedBatchForPrint.productName}
              batchNumber={selectedBatchForPrint.batchNumber}
              batchDate={selectedBatchForPrint.batchDate}
            />
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {item ? (
              <Button type="button" variant="outline" onClick={handleDelete} disabled={loading} className="text-red-600 border-red-200 hover:bg-red-50">
                Excluir
              </Button>
            ) : <span />}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (item ? 'Salvar' : 'Criar Item')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
