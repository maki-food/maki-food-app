import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ImageIcon, Star, Layers, Plus, Trash2, Boxes } from 'lucide-react';
import { optimizeImage } from '@/lib/imageUpload';
import { logAction } from '@/lib/audit';
import { toast } from '@/components/ui/use-toast';
import { formatBRL } from '@/lib/format';

const channels = ['Loja Física', 'Loja Online'];

const emptyForm = {
  description: '', price: '', image_url: '', sku: '', ncm: '',
  default_weight_kg: '',
  sales_channels: [], is_promotion: false, profit_margin_pct: '', tax_fee_pct: '', tax_pct: '',
  estimated_freight: '', available: true,
  is_raw_material: false, parent_product_id: '',
};

// Formulário de "Produto" = vender ao cliente algo que já existe no Estoque.
// Nome, SKU, código de barras, estoque e unidade vêm do item do Estoque
// (só lá se corrige); aqui só se define o lado comercial: preço, categoria,
// imagem, descrição e variações.
export default function ProductForm({ product, open, onClose, onSave }) {
  const [stockItems, setStockItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [variantTypes, setVariantTypes] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantTypeId, setVariantTypeId] = useState('');
  const [variantRows, setVariantRows] = useState([]);
  const emptyVariantRow = () => ({ id: null, name: '', price: '', default_weight_kg: '', sku: '' });

  const selected = stockItems.find(p => p.id === selectedId) || product || null;

  useEffect(() => {
    if (!open) return;
    base44.entities.Category.list().then(cats => {
      const names = cats.map(c => c.name);
      setCategories(names.length > 0 ? names : ['Peixes', 'Arroz', 'Algas Nori', 'Molhos', 'Cream Cheese', 'Vegetais', 'Utensílios', 'Embalagens']);
    }).catch(() => setCategories(['Peixes', 'Arroz', 'Algas Nori', 'Molhos', 'Cream Cheese', 'Vegetais', 'Utensílios', 'Embalagens']));
    base44.entities.Product.list().then(prods => {
      setStockItems(prods);
      setRawMaterials(prods.filter(p => p.is_raw_material));
    }).catch(() => {});
    base44.entities.VariantType.list('name').then(setVariantTypes).catch(() => setVariantTypes([]));
  }, [open]);

  useEffect(() => {
    if (open && product) {
      base44.entities.ProductVariant.filter({ product_id: product.id }).then(rows => {
        if (rows && rows.length > 0) {
          setHasVariants(true);
          setVariantTypeId(rows[0].variant_type_id || '');
          setVariantRows(rows
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(r => ({
              id: r.id, name: r.name || '',
              price: r.price != null ? String(r.price) : '',
              default_weight_kg: r.default_weight_kg != null ? String(r.default_weight_kg) : '',
              sku: r.sku || '',
            })));
        } else {
          setHasVariants(false); setVariantTypeId(''); setVariantRows([]);
        }
      }).catch(() => {});
    } else if (open && !product) {
      setHasVariants(false); setVariantTypeId(''); setVariantRows([]);
    }
  }, [open, product]);

  useEffect(() => {
    if (product) {
      setSelectedId(product.id);
      setForm({
        description: product.description || '', price: product.price || '', image_url: product.image_url || '',
        sku: product.sku || '', ncm: product.ncm || '',
        default_weight_kg: product.default_weight_kg != null ? String(product.default_weight_kg) : '',
        sales_channels: product.sales_channels || [], is_promotion: product.is_promotion || false,
        profit_margin_pct: product.profit_margin_pct || '', tax_fee_pct: product.tax_fee_pct || '',
        tax_pct: product.tax_pct || '', estimated_freight: product.estimated_freight || '',
        available: product.available !== false,
        is_raw_material: product.is_raw_material || false, parent_product_id: product.parent_product_id || '',
      });
    } else {
      setSelectedId('');
      setForm(emptyForm);
    }
  }, [product, open]);

  const handlePickStockItem = (id) => {
    setSelectedId(id);
    const item = stockItems.find(p => p.id === id);
    if (item) {
      setForm(prev => ({
        ...prev,
        price: item.price > 0 ? item.price : prev.price,
        description: item.description || prev.description,
        image_url: item.image_url || prev.image_url,
        sku: item.sku || prev.sku,
        ncm: item.ncm || prev.ncm,
      }));
    }
  };

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

  const toggleChannel = (ch) => {
    setForm(prev => ({
      ...prev,
      sales_channels: prev.sales_channels.includes(ch) ? prev.sales_channels.filter(c => c !== ch) : [...prev.sales_channels, ch],
    }));
  };

  const addVariantRow = () => setVariantRows(prev => [...prev, emptyVariantRow()]);
  const removeVariantRow = (idx) => setVariantRows(prev => prev.filter((_, i) => i !== idx));
  const updateVariantRow = (idx, field, value) => setVariantRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const syncVariants = async (productId) => {
    if (!hasVariants) {
      if (product) {
        const existing = await base44.entities.ProductVariant.filter({ product_id: productId }).catch(() => []);
        for (const v of existing || []) await base44.entities.ProductVariant.delete(v.id);
      }
      return;
    }
    const validRows = variantRows.filter(r => r.name.trim());
    const existing = await base44.entities.ProductVariant.filter({ product_id: productId }).catch(() => []);
    const keepIds = new Set();
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const payload = {
        product_id: productId, variant_type_id: variantTypeId || null, name: row.name.trim(),
        price: parseFloat(row.price) || 0, sku: row.sku || null,
        default_weight_kg: row.default_weight_kg !== '' ? parseFloat(row.default_weight_kg) : null,
        sort_order: i,
      };
      if (row.id) { keepIds.add(row.id); await base44.entities.ProductVariant.update(row.id, payload); }
      else { const created = await base44.entities.ProductVariant.create(payload); keepIds.add(created.id); }
    }
    for (const v of existing || []) {
      if (!keepIds.has(v.id)) await base44.entities.ProductVariant.delete(v.id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) {
      toast({ variant: 'destructive', title: 'Selecione um item do Estoque primeiro' });
      return;
    }
    setLoading(true);
    const data = {
      description: form.description,
      price: parseFloat(form.price) || 0,
      default_weight_kg: form.default_weight_kg !== '' ? parseFloat(form.default_weight_kg) : null,
      image_url: form.image_url,
      sku: form.sku || null,
      ncm: form.ncm || null,
      category: selected?.category || null,
      is_promotion: form.is_promotion,
      available: form.available,
      sales_channels: form.sales_channels,
      profit_margin_pct: parseFloat(form.profit_margin_pct) || 0,
      tax_fee_pct: parseFloat(form.tax_fee_pct) || 0,
      tax_pct: parseFloat(form.tax_pct) || 0,
      estimated_freight: parseFloat(form.estimated_freight) || 0,
      is_raw_material: form.is_raw_material || false,
      parent_product_id: (form.parent_product_id === 'none' || !form.parent_product_id) ? null : form.parent_product_id,
    };
    try {
      await base44.entities.Product.update(selectedId, data);
      await syncVariants(selectedId);
      await logAction(product ? 'Produto Atualizado' : 'Produto Publicado', selected?.name || '');
      onSave?.();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar produto', description: err.message || 'Tente novamente em instantes.' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-full max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Publicar Produto do Estoque'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!product && (
            <div>
              <Label>Item do Estoque *</Label>
              <Select value={selectedId} onValueChange={handlePickStockItem}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o item já cadastrado no Estoque" /></SelectTrigger>
                <SelectContent>
                  {stockItems.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.price > 0 ? '(já publicado)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Não achou? Cadastre primeiro na tela de Estoque.</p>
            </div>
          )}

          {selected && (
            <>
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 text-sm">
                <Boxes className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-700">{selected.name}</p>
                  <p className="text-xs text-slate-400">
                    Cód. Barras: {selected.barcode || '-'} • Estoque: {selected.stock_quantity || 0} {selected.unit} (mín. {selected.min_stock || 0})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
                  {form.image_url ? <img src={form.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                </div>
                <label className="cursor-pointer text-sm text-emerald-600 font-medium hover:text-emerald-700">
                  {uploading ? 'Enviando...' : 'Enviar imagem'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} placeholder="Descrição do produto" />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados Comerciais</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço de Venda (R$) *</Label>
                    <Input required type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="mt-1" placeholder="0,00" />
                  </div>
                  <div>
                    <Label>Peso por unidade (kg)</Label>
                    <Input type="number" step="0.01" value={form.default_weight_kg || ''} onChange={e => setForm({ ...form, default_weight_kg: e.target.value })} className="mt-1" placeholder="Ex: 4.00" />
                    <p className="text-xs text-slate-400 mt-1">Use quando o produto em kg deve ser vendido em unidades inteiras com peso fixo.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={selected.category || ''} onValueChange={async (v) => {
                      await base44.entities.Product.update(selectedId, { category: v });
                      setStockItems(prev => prev.map(p => p.id === selectedId ? { ...p, category: v } : p));
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="mt-1" placeholder="SKU-001" />
                  </div>
                  <div>
                    <Label>NCM</Label>
                    <Input value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} className="mt-1" placeholder="0000.00.00" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button type="button" onClick={() => setForm({ ...form, is_raw_material: !form.is_raw_material })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${form.is_raw_material ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {form.is_raw_material ? '✓ Matéria-Prima' : 'Marcar como Matéria-Prima'}
                  </button>
                </div>
                {!form.is_raw_material && rawMaterials.length > 0 && (
                  <div className="mt-3">
                    <Label>Produto Pai (Matéria-Prima)</Label>
                    <Select value={form.parent_product_id || 'none'} onValueChange={v => setForm({ ...form, parent_product_id: v === 'none' ? '' : v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {rawMaterials.map(rm => <SelectItem key={rm.id} value={rm.id}>{rm.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Canais de Venda</Label>
                  <div className="flex gap-2 mt-1">
                    {channels.map(ch => (
                      <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.sales_channels.includes(ch) ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <PricingAssistant selected={selected} form={form} setForm={setForm} />

              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Variações
                  </p>
                  <button type="button" onClick={() => { setHasVariants(!hasVariants); if (!hasVariants && variantRows.length === 0) setVariantRows([emptyVariantRow()]); }}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${hasVariants ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                    {hasVariants ? 'Este produto tem variações' : 'Produto sem variações'}
                  </button>
                </div>
                {hasVariants && (
                  <>
                    <p className="text-xs text-slate-500">
                      Ex: para "Salmão", crie as opções Caixa, Unidade e Filé — cada uma com preço e peso próprios.
                      O cliente escolhe a variação na loja; todas consomem do mesmo estoque.
                    </p>
                    <div>
                      <Label className="text-xs">Tipo de Variação</Label>
                      <Select value={variantTypeId || 'none'} onValueChange={v => setVariantTypeId(v === 'none' ? '' : v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum / não classificado</SelectItem>
                          {variantTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-400 mt-1">Não achou o tipo? Cadastre em <span className="font-medium">Variações</span> no menu lateral.</p>
                    </div>
                    <div className="space-y-2">
                      {variantRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2 items-start bg-white rounded-lg p-2 border border-slate-100">
                          <Input value={row.name} onChange={e => updateVariantRow(idx, 'name', e.target.value)} placeholder="Ex: Caixa" className="flex-1" />
                          <Input type="number" step="0.01" value={row.price} onChange={e => updateVariantRow(idx, 'price', e.target.value)} placeholder="Preço" className="w-24" />
                          <Input type="number" step="0.01" value={row.default_weight_kg} onChange={e => updateVariantRow(idx, 'default_weight_kg', e.target.value)} placeholder={`Consumo por venda (${selected.unit})`} className="w-36" />
                          <button type="button" onClick={() => removeVariantRow(idx)} className="p-2 text-red-400 hover:text-red-600 flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addVariantRow} className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700">
                      <Plus className="w-3 h-3" /> Adicionar variação
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !selectedId} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PricingAssistant({ selected, form, setForm }) {
  const cost = selected?.purchase_cost || 0;
  const freight = parseFloat(form.estimated_freight) || 0;
  const margin = parseFloat(form.profit_margin_pct) || 0;
  const taxPct = parseFloat(form.tax_pct) || 0;
  const cardFee = parseFloat(form.tax_fee_pct) || 0;

  const baseCost = cost + freight;
  const percentTotal = margin + taxPct + cardFee;
  const suggestedPrice = percentTotal < 100 && percentTotal >= 0
    ? (percentTotal === 0 ? baseCost : baseCost / (1 - percentTotal / 100))
    : null;

  const currentPrice = parseFloat(form.price) || 0;
  const currentMargin = currentPrice > 0 ? (((currentPrice - baseCost) / currentPrice) * 100) : null;

  return (
    <div className="bg-emerald-50 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Assistente de Precificação</p>

      <div>
        <Label className="text-xs">Custo de Compra (R$)</Label>
        <Input disabled value={cost > 0 ? formatBRL(cost) : 'Sem compra registrada ainda'} className="mt-1 bg-white" />
        <p className="text-xs text-slate-400 mt-1">Vem automaticamente da última Compra lançada — muda um, muda o outro.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Frete / Adicionais (R$)</Label>
          <Input type="number" step="0.01" value={form.estimated_freight} onChange={e => setForm({ ...form, estimated_freight: e.target.value })} className="mt-1" placeholder="0,00" />
        </div>
        <div>
          <Label className="text-xs">Margem Desejada (%)</Label>
          <Input type="number" step="0.01" value={form.profit_margin_pct} onChange={e => setForm({ ...form, profit_margin_pct: e.target.value })} className="mt-1" placeholder="30" />
        </div>
        <div>
          <Label className="text-xs">Impostos (%)</Label>
          <Input type="number" step="0.01" value={form.tax_pct} onChange={e => setForm({ ...form, tax_pct: e.target.value })} className="mt-1" placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Taxa Cartão (%)</Label>
          <Input type="number" step="0.01" value={form.tax_fee_pct} onChange={e => setForm({ ...form, tax_fee_pct: e.target.value })} className="mt-1" placeholder="4.99" />
        </div>
      </div>

      <div className="bg-white rounded-lg px-3 py-2.5 space-y-1">
        {suggestedPrice != null ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Preço sugerido</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-emerald-700">{formatBRL(suggestedPrice)}</span>
              <button type="button" onClick={() => setForm({ ...form, price: suggestedPrice.toFixed(2) })}
                className="text-xs font-medium bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700">
                Aplicar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-red-500">Margem + Impostos + Taxa Cartão não pode chegar a 100% — ajuste os percentuais.</p>
        )}
        {currentMargin != null && (
          <p className="text-xs text-slate-400">Com o preço de venda atual, a margem real é <strong>{currentMargin.toFixed(1)}%</strong></p>
        )}
      </div>
    </div>
  );
}
