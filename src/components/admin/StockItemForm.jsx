import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ImageIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { logAction } from '@/lib/audit';
import { optimizeImage } from '@/lib/imageUpload';

const units = ['kg', 'g', 'un', 'litro', 'ml'];

const emptyForm = { name: '', unit: 'un', min_stock: '10', image_url: '' };

/**
 * Cadastro/edição rápida de item no Estoque — nome, unidade real (kg/g/un/
 * litro/ml — nunca "caixa", que é só embalagem de compra), estoque mínimo e
 * foto (essa foto já vai junto quando o item for publicado em Produtos).
 * Código de barras é lançado nas Compras. SKU e NCM ficam pra Produtos.
 */
export default function StockItemForm({ item, open, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name || '', unit: item.unit || 'un',
        min_stock: item.min_stock != null ? String(item.min_stock) : '10',
        image_url: item.image_url || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, item]);

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
        min_stock: Math.round(parseFloat(form.min_stock) || 0),
        image_url: form.image_url,
      };
      if (item) {
        await base44.entities.Product.update(item.id, payload);
        await logAction('Item de Estoque Editado', form.name);
      } else {
        const created = await base44.entities.Product.create({
          ...payload, price: 0, stock_quantity: 0, category: null, description: '',
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item de Estoque' : 'Novo Item de Estoque'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
              {form.image_url ? <img src={form.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
            </div>
            <label className="cursor-pointer text-sm text-emerald-600 font-medium hover:text-emerald-700">
              {uploading ? 'Enviando...' : 'Enviar foto'}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          <div>
            <Label>Nome *</Label>
            <Input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Ex: Salmão Inteiro" />
          </div>
          <div>
            <Label>Unidade de Estoque</Label>
            <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">A unidade real do produto (não a embalagem de compra — "caixa" é escolhido só na hora da Compra).</p>
          </div>
          <div>
            <Label>Estoque Mínimo</Label>
            <Input type="number" step="1" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="mt-1" />
          </div>
          <p className="text-xs text-slate-400">Código de barras é lançado nas Compras. SKU, NCM, preço, categoria são definidos depois, em Produtos.</p>
          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            {item ? (
              <Button type="button" variant="outline" onClick={handleDelete} disabled={loading} className="text-red-600 border-red-200 hover:bg-red-50 mr-auto">
                Excluir
              </Button>
            ) : <span />}
            <div className="flex gap-2">
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
