import React, { useState, useEffect, useRef } from 'react';
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
  purchaseQty: '1', contentPerBox: '', totalCost: '', expirationDate: '', barcode: '', unit: 'un',
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

const normalizeSearchValue = (value) => String(value || '').trim().toLowerCase();
const findProductMatch = (value, products) => {
  const needle = normalizeSearchValue(value);
  if (!needle) return null;
  if (/^\d+$/.test(needle)) {
    return products.find(p => String(p.barcode || '').trim().toLowerCase() === needle);
  }
  return products.find(p => String(p.name || '').trim().toLowerCase() === needle);
};

const filterProductSuggestions = (value, products) => {
  const needle = String(value || '').trim().toLowerCase();
  if (!needle) return [];
  if (/^\d+$/.test(needle)) {
    return products.filter(p => String(p.barcode || '').trim().toLowerCase().startsWith(needle));
  }
  return products.filter(p => String(p.name || '').trim().toLowerCase().startsWith(needle));
};

function unitCost(item) {
  const received = receivedQuantity(item);
  const cost = parseFloat(item.totalCost) || 0;
  if (received <= 0) return 0;
  return Number((cost / received).toFixed(2));
}

function calculateAutomaticSalePrice(product, newCost) {
  const freight = parseFloat(product?.estimated_freight) || 0;
  const margin = parseFloat(product?.profit_margin_pct) || 0;
  const taxPct = parseFloat(product?.tax_pct) || 0;
  const cardFee = parseFloat(product?.tax_fee_pct) || 0;
  const percentTotal = margin + taxPct + cardFee;

  if (percentTotal >= 100 || percentTotal < 0) return null;
  const baseCost = newCost + freight;
  const suggestedPrice = percentTotal === 0
    ? baseCost
    : baseCost / (1 - percentTotal / 100);

  return Number(suggestedPrice.toFixed(2));
}

function aggregatePurchaseItems(items) {
  const grouped = new Map();
  for (const item of items) {
    const price = Number(unitCost(item));
    const key = [
      item.productId,
      item.expirationDate || '',
      item.purchaseType,
      item.contentPerBox || '',
      price,
    ].join('||');

    const existing = grouped.get(key);
    if (existing) {
      const newPurchaseQty = (parseFloat(existing.purchaseQty) || 0) + (parseFloat(item.purchaseQty) || 0);
      const newTotalCost = (parseFloat(existing.totalCost) || 0) + (parseFloat(item.totalCost) || 0);
      grouped.set(key, {
        ...existing,
        purchaseQty: String(newPurchaseQty),
        totalCost: String(newTotalCost),
      });
    } else {
      grouped.set(key, { ...item, purchaseQty: String(item.purchaseQty || '0'), totalCost: String(item.totalCost || '0') });
    }
  }
  return Array.from(grouped.values());
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
  const [focusedItemIndex, setFocusedItemIndex] = useState(null);
  const formRef = useRef(null);

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
            const matched = p.product_id
              ? prods.find(prod => prod.id === p.product_id)
              : prods.find(prod => prod.name === p.product_name);
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

      if (field === 'product_name') {
        const matched = findProductMatch(value, products);
        if (matched) {
          updated.productId = matched.id;
          updated.product_name = matched.name || value;
          updated.barcode = matched.barcode || updated.barcode;
          updated.unit = matched.unit || updated.unit;
        } else {
          updated.productId = '';
        }
      }

      if (field === 'productId') {
        const p = products.find(pr => pr.id === value);
        updated.product_name = p?.name || updated.product_name;
        updated.barcode = p?.barcode || updated.barcode;
        updated.unit = p?.unit || updated.unit;
      }

      if (field === 'purchaseType' && !updated.unit) {
        updated.unit = TYPE_TO_UNIT[value] || updated.unit;
      }

      return updated;
    }));
  };

  const [newItemPrefill, setNewItemPrefill] = useState(null);

  const openNewItem = (idx, prefill) => {
    setNewItemForIdx(idx);
    setNewItemPrefill(prefill || null);
    setNewItemOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        setFocusedItemIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectProductSuggestion = (product, idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      productId: product.id,
      product_name: product.name || it.product_name,
      barcode: product.barcode || it.barcode,
      unit: product.unit || it.unit,
    } : it));
    setFocusedItemIndex(null);
  };

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
    if (loading) return;
    setLoading(true);

    try {
      const validItems = items.filter(i => i.product_name.trim());
      const aggregatedItems = aggregatePurchaseItems(validItems);
      const preparedItems = await Promise.all(aggregatedItems.map(async (item) => {
        if (item.productId) return item;
        const matchedProduct = findProductMatch(item.product_name, products);
        if (matchedProduct) {
          return {
            ...item,
            productId: matchedProduct.id,
            barcode: matchedProduct.barcode || item.barcode,
            unit: matchedProduct.unit || item.unit,
          };
        }

        const createdProduct = await base44.entities.Product.create({
          name: item.product_name.trim(),
          barcode: item.barcode || null,
          unit: item.unit || TYPE_TO_UNIT[item.purchaseType] || 'un',
          purchase_cost: unitCost(item),
          price: 0,
          stock_quantity: 0,
          available: false,
          category: null,
          description: '',
        });

        if (createdProduct?.id) {
          setProducts((prev) => [...prev, createdProduct]);
          return {
            ...item,
            productId: createdProduct.id,
          };
        }

        return item;
      }));

      if (preparedItems.some(i => !i.productId)) {
        throw new Error('Não foi possível vincular ou criar todos os produtos da compra. Verifique os itens e tente novamente.');
      }

      const productData = preparedItems.map(i => ({
        product_id: i.productId || null,
        product_name: i.product_name.trim(),
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

      const existingBatches = purchase ? await base44.entities.ProductBatch.filter({ purchase_id: purchaseId }).catch(() => []) : [];
      const usedBatchIds = new Set();
      const affectedProductIds = new Set(existingBatches.map(b => b.product_id));

      await Promise.all(preparedItems.map(async (item) => {
        const productId = item.productId;
        const received = receivedQuantity(item);
        const existing = existingBatches.find(b => b.product_id === productId && !usedBatchIds.has(b.id));
        
        if (existing) {
          usedBatchIds.add(existing.id);
          await base44.entities.ProductBatch.update(existing.id, {
            quantity: received,
            expiration_date: item.expirationDate || null,
          });
        } else {
          await base44.stock.addBatch({
            productId,
            quantity: received,
            expirationDate: item.expirationDate || null,
            purchaseId,
          });
        }
        affectedProductIds.add(productId);
      }));

      await Promise.all(existingBatches.filter(b => !usedBatchIds.has(b.id)).map(async (b) => {
        // Quando um lote é deletado, o trigger SQL (recompute_product_stock) dispara
        // automaticamente e recalcula o estoque total. NÃO precisa chamar adjustProductStock!
        await base44.entities.ProductBatch.delete(b.id);
        affectedProductIds.add(b.product_id);
      }));

      // Atualiza automaticamente somente quando o novo custo unitário é maior.
      // O preço manual não é reduzido quando chega uma compra mais barata.
      const newCostsByProduct = new Map();
      for (const item of preparedItems) {
        const newCost = unitCost(item);
        const previousCost = newCostsByProduct.get(item.productId) || 0;
        newCostsByProduct.set(item.productId, Math.max(previousCost, newCost));
      }

      await Promise.all(Array.from(newCostsByProduct.entries()).map(async ([productId, newCost]) => {
        if (!Number.isFinite(newCost) || newCost <= 0) return;

        const currentProduct = await base44.entities.Product.get(productId).catch(() => null);
        if (!currentProduct) return;

        const currentCost = Number(currentProduct.purchase_cost || 0);
        if (newCost <= currentCost) return;

        const automaticPrice = calculateAutomaticSalePrice(currentProduct, newCost);
        const payload = { purchase_cost: newCost };
        if (automaticPrice != null) payload.price = automaticPrice;

        await base44.entities.Product.update(productId, payload);
      }));

      await logAction(purchase ? 'Compra Editada' : 'Compra Registrada', `Fornecedor: ${supplierName} - NF: ${invoiceNumber} - ${formatBRL(total)}`);
      onSave?.();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar compra', description: err.message || 'Tente novamente em instantes.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{purchase ? 'Editar Compra' : 'Nova Compra de Fornecedor'}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
                    <div className="space-y-2">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Label className="text-xs">Produto ou Código de Barras *</Label>
                          <div className="relative">
                            <Input
                              required
                              value={item.product_name}
                              onFocus={() => setFocusedItemIndex(idx)}
                              onChange={e => { updateItem(idx, 'product_name', e.target.value); setFocusedItemIndex(idx); }}
                              className="mt-1"
                              placeholder="Buscar por nome ou código de barras"
                            />
                            {focusedItemIndex === idx && filterProductSuggestions(item.product_name, products).length > 0 && (
                              <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                                {filterProductSuggestions(item.product_name, products).map(product => (
                                  <button
                                    type="button"
                                    key={product.id}
                                    onClick={() => selectProductSuggestion(product, idx)}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                  >
                                    <div className="font-medium">{product.name}</div>
                                    {product.barcode && <div className="text-xs text-slate-500">{product.barcode}</div>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.productId && product ? (
                        <p className="text-xs text-slate-500">Produto existente: {product.name} • Estoque atual: {product.stock_quantity || 0} {product.unit || ''}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
                          <span>Produto não encontrado no estoque.</span>
                          <button
                            type="button"
                            onClick={() => openNewItem(idx, {
                              name: item.product_name.trim(),
                              barcode: item.barcode || '',
                              unit: item.unit || TYPE_TO_UNIT[item.purchaseType] || 'un',
                              purchase_cost: unitCost(item),
                            })}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            Criar item no estoque
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Código de Barras</Label>
                          <Input value={item.barcode} onChange={e => updateItem(idx, 'barcode', e.target.value)} className="mt-1 h-9" placeholder="789..." />
                        </div>
                        <div>
                          <Label className="text-xs">Unidade</Label>
                          <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)} disabled={Boolean(item.productId && product)}>
                            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['un', 'kg', 'litro', 'ml'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
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
                        <Input type="number" step="1" min="1" value={item.purchaseQty} onWheel={e => e.currentTarget.blur()} onChange={e => updateItem(idx, 'purchaseQty', e.target.value)} className="mt-1 h-9" />
                      </div>
                    </div>

                    {item.purchaseType === 'caixa' && (
                      <div>
                        <Label className="text-xs">Quanto vem em cada caixa (em {product?.unit || 'kg/un'})</Label>
                        <Input type="number" step="0.01" value={item.contentPerBox} onWheel={e => e.currentTarget.blur()} onChange={e => updateItem(idx, 'contentPerBox', e.target.value)} className="mt-1 h-9" placeholder="Ex: 30" />
                      </div>
                    )}

                    <div>
                      <Label className="text-xs">Custo Total deste item (R$)</Label>
                      <Input type="number" step="0.01" value={item.totalCost} onWheel={e => e.currentTarget.blur()} onChange={e => updateItem(idx, 'totalCost', e.target.value)} className="mt-1 h-9" placeholder="0,00" />
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

      <StockItemForm
        open={newItemOpen}
        prefill={newItemPrefill}
        onClose={() => { setNewItemOpen(false); setNewItemForIdx(null); setNewItemPrefill(null); }}
        onSave={handleNewItemSaved}
      />
    </Dialog>
  );
}
