import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Upload, FileText } from 'lucide-react';
import { optimizeImage } from '@/lib/imageUpload';
import { toast } from '@/components/ui/use-toast';
import StockItemForm from '@/components/admin/StockItemForm';

// Como você comprou esse item — determina o que perguntar em seguida
const PURCHASE_TYPES = [
  { value: 'unidade', label: 'Unidade' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'kg', label: 'Kg' },
  { value: 'litro', label: 'Litro' },
  { value: 'ml', label: 'mL' },
];

const emptyItem = () => ({
  productId: '', product_name: '', purchaseType: 'unidade',
  purchaseQty: '1', contentPerBox: '', totalCost: '', expirationDate: '', barcode: '',
});

// Quanto foi recebido, na unidade de estoque do produto (kg, un, etc)
function receivedQuantity(item) {
  const qty = parseFloat(item.purchaseQty) || 0;
  if (item.purchaseType === 'caixa') {
    return qty * (parseFloat(item.contentPerBox) || 0);
  }
  return qty; // unidade/kg/litro/ml compradas diretamente = quantidade recebida
}

// 'caixa' nunca vira unidade de estoque sozinha — é sempre embalagem de algo
// medido em outra unidade (kg/un/litro/ml), por isso não entra aqui.
const TYPE_TO_UNIT = { unidade: 'un', kg: 'kg', litro: 'litro', ml: 'ml' };

function unitCost(item) {
  const received = receivedQuantity(item);
  const cost = parseFloat(item.totalCost) || 0;
  return received > 0 ? cost / received : 0;
}

export default function PurchaseForm({ purchase, open, onClose, onSave }) {
  const [products, setProducts] = useState([]);
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([emptyItem()]);
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemForIdx, setNewItemForIdx] = useState(null);

  const loadProducts = () => base44.entities.Product.list();

  useEffect(() => {
    if (open) {
      loadProducts().then(async (prods) => {
        setProducts(prods);
        if (purchase) {
          setSupplierName(purchase.supplier_name || '');
          setInvoiceNumber(purchase.invoice_number || '');
          setDate(purchase.date || new Date().toISOString().split('T')[0]);
          setInvoicePhotoUrl(purchase.invoice_photo_url || '');

          const existingBatches = await base44.entities.ProductBatch.filter({ purchase_id: purchase.id }).catch(() => []);

          setItems((purchase.products || []).map(p => {
            const matched = prods.find(prod => prod.name === p.product_name);
            const batch = existingBatches.find(b => b.product_id === matched?.id);
            return {
              productId: matched?.id || '',
              product_name: p.product_name || '',
              purchaseType: p.purchase_type || 'unidade',
              purchaseQty: p.purchase_qty != null ? String(p.purchase_qty) : String(p.quantity || 1),
              contentPerBox: p.content_per_box ? String(p.content_per_box) : '',
              totalCost: p.total_cost != null ? String(p.total_cost) : (p.price ? String((parseFloat(p.price) || 0) * (parseFloat(p.quantity) || 0)) : ''),
              expirationDate: batch?.expiration_date || '',
              barcode: matched?.barcode || '',
            };
          }));
        } else {
          setSupplierName(''); setInvoiceNumber('');
          setDate(new Date().toISOString().split('T')[0]);
          setInvoicePhotoUrl('');
          setItems([emptyItem()]);
        }
      }).catch(() => {});
    }
  }, [open, purchase]);

  const total = items.reduce((s, i) => s + (parseFloat(i.totalCost) || 0), 0);

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === 'productId') {
        const p = products.find(pr => pr.id === value);
        updated.product_name = p?.name || '';
        updated.barcode = p?.barcode || '';
      }
      return updated;
    }));
  };

  const openNewItem = (idx) => { setNewItemForIdx(idx); setNewItemOpen(true); };

  const handleNewItemSaved = async (created) => {
    const prods = await loadProducts();
    setProducts(prods);
    if (newItemForIdx !== null && created) {
      updateItem(newItemForIdx, 'productId', created.id);
    }
    setNewItemOpen(false);
    setNewItemForIdx(null);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const optimized = await optimizeImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
      setInvoicePhotoUrl(file_url);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao enviar foto', description: err.message });
    }
    setUploadingPhoto(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validItems = items.filter(i => i.productId);
      const productData = validItems.map(i => ({
        product_name: i.product_name,
        purchase_type: i.purchaseType,
        purchase_qty: parseFloat(i.purchaseQty) || 0,
        content_per_box: i.purchaseType === 'caixa' ? (parseFloat(i.contentPerBox) || 0) : null,
        quantity: receivedQuantity(i),
        total_cost: parseFloat(i.totalCost) || 0,
        price: unitCost(i),
      }));

      let purchaseId = purchase?.id;
      if (purchase) {
        await base44.entities.Purchase.update(purchase.id, {
          supplier_name: supplierName, invoice_number: invoiceNumber, date,
          products: productData, total, invoice_photo_url: invoicePhotoUrl,
        });
      } else {
        const created = await base44.entities.Purchase.create({
          supplier_name: supplierName, invoice_number: invoiceNumber, date,
          products: productData, total, invoice_photo_url: invoicePhotoUrl,
        });
        purchaseId = created.id;
      }

      // Reconcilia os lotes de estoque desta compra com os itens atuais
      const existingBatches = purchase ? await base44.entities.ProductBatch.filter({ purchase_id: purchaseId }) : [];
      const usedBatchIds = new Set();

      for (const item of validItems) {
        const received = receivedQuantity(item);
        const existing = existingBatches.find(b => b.product_id === item.productId && !usedBatchIds.has(b.id));
        if (existing) {
          usedBatchIds.add(existing.id);
          await base44.entities.ProductBatch.update(existing.id, {
            quantity: received,
            expiration_date: item.expirationDate || null,
          });
        } else {
          await base44.stock.addBatch({
            productId: item.productId,
            quantity: received,
            expirationDate: item.expirationDate || null,
            purchaseId,
          });
        }
        // Guarda o custo por unidade dessa última compra no produto, pra referência,
        // e sincroniza a unidade de estoque com o que foi realmente comprado
        // (comprou em kg, o estoque passa a ser em kg — exceto "caixa", que nunca
        // vira unidade sozinha, pois é sempre embalagem de outra coisa)
        const updates = { purchase_cost: unitCost(item) };
        if (item.barcode) updates.barcode = item.barcode;
        if (TYPE_TO_UNIT[item.purchaseType]) updates.unit = TYPE_TO_UNIT[item.purchaseType];
        await base44.entities.Product.update(item.productId, updates);
      }
      for (const b of existingBatches) {
        if (!usedBatchIds.has(b.id)) await base44.entities.ProductBatch.delete(b.id);
      }

      await logAction(purchase ? 'Compra Editada' : 'Compra Registrada', `Fornecedor: ${supplierName} - NF: ${invoiceNumber} - ${formatBRL(total)}`);
      onSave?.();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar compra', description: err.message || 'Tente novamente em instantes.' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{purchase ? 'Editar Compra' : 'Nova Compra de Fornecedor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome do Fornecedor *</Label>
            <Input required value={supplierName} onChange={e => setSupplierName(e.target.value)} className="mt-1" placeholder="Ex: Distribuidora Japão" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número da Nota Fiscal *</Label>
              <Input required value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="mt-1" placeholder="000.000.000" />
            </div>
            <div>
              <Label>Data</Label>
              <DateInput value={date} onChange={v => setDate(v)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Foto da Nota Fiscal</Label>
            <div className="flex items-center gap-3 mt-1">
              {invoicePhotoUrl ? (
                <div className="relative">
                  <img src={invoicePhotoUrl} alt="NF" className="w-16 h-16 rounded-lg border border-slate-200 object-cover" />
                  <button type="button" onClick={() => setInvoicePhotoUrl('')} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                  <FileText className="w-5 h-5 text-slate-300" />
                </div>
              )}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4" />
                {uploadingPhoto ? 'Enviando...' : 'Enviar Foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            </div>
          </div>
          <div>
            <Label>Itens da Compra</Label>
            <div className="space-y-3 mt-1">
              {items.map((item, idx) => {
                const product = products.find(p => p.id === item.productId);
                const received = receivedQuantity(item);
                const cost = unitCost(item);
                return (
                  <div key={idx} className="space-y-2 p-3 rounded-lg border border-slate-100">
                    <div className="flex gap-2 items-start">
                      <Select value={item.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Item do estoque" /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button type="button" onClick={() => openNewItem(idx)} className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700">
                      <Plus className="w-3 h-3" /> Não achou? Cadastrar no Estoque
                    </button>

                    <div>
                      <Label className="text-xs">Código de Barras (da nota fiscal)</Label>
                      <Input value={item.barcode} onChange={e => updateItem(idx, 'barcode', e.target.value)} className="mt-1 h-9" placeholder="789..." />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Comprei por</Label>
                        <Select value={item.purchaseType} onValueChange={v => updateItem(idx, 'purchaseType', v)}>
                          <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PURCHASE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Quantas {PURCHASE_TYPES.find(t => t.value === item.purchaseType)?.label.toLowerCase()}(s)</Label>
                        <Input type="number" step="1" min="1" value={item.purchaseQty} onChange={e => updateItem(idx, 'purchaseQty', e.target.value)} className="mt-1 h-9" />
                      </div>
                    </div>

                    {item.purchaseType === 'caixa' && (
                      <div>
                        <Label className="text-xs">Quanto vem em cada caixa (em {product?.unit || 'kg/un'})</Label>
                        <Input type="number" step="0.01" value={item.contentPerBox} onChange={e => updateItem(idx, 'contentPerBox', e.target.value)} className="mt-1 h-9" placeholder="Ex: 30" />
                      </div>
                    )}

                    <div>
                      <Label className="text-xs">Custo Total deste item (R$)</Label>
                      <Input type="number" step="0.01" value={item.totalCost} onChange={e => updateItem(idx, 'totalCost', e.target.value)} className="mt-1 h-9" placeholder="0,00" />
                    </div>

                    <div>
                      <Label className="text-xs">Validade deste lote</Label>
                      <DateInput value={item.expirationDate} onChange={v => updateItem(idx, 'expirationDate', v)} className="mt-1 w-40" />
                    </div>

                    {item.productId && received > 0 && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5">
                        Recebido: <strong>{received} {TYPE_TO_UNIT[item.purchaseType] || product?.unit || ''}</strong>
                        {parseFloat(item.totalCost) > 0 && <> • Custo por {TYPE_TO_UNIT[item.purchaseType] || product?.unit || 'unidade'}: <strong>{formatBRL(cost)}</strong></>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-sm text-emerald-600 font-medium hover:text-emerald-700">
              <Plus className="w-4 h-4" /> Adicionar item
            </button>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-bold text-slate-900">{formatBRL(total)}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (purchase ? 'Salvar Alterações' : 'Registrar Compra')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <StockItemForm open={newItemOpen} onClose={() => { setNewItemOpen(false); setNewItemForIdx(null); }} onSave={handleNewItemSaved} />
    </Dialog>
  );
}
