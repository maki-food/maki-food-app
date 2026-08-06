import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ClipboardMinus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const REASONS = ['Validade Vencida', 'Dano/Avaria', 'Contaminação', 'Perda', 'Outro'];

export default function WriteOffModal({ open, onClose, products = [], onSave }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProductId('');
      setQuantity(1);
      setReason('');
      setNotes('');
    }
  }, [open]);

  const selectedProduct = products.find(p => p.id === productId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !reason) return;
    setSaving(true);
    try {
      await base44.entities.InventoryWriteOff.create({
        product_name: selectedProduct.name,
        product_id: selectedProduct.id,
        quantity: parseFloat(quantity) || 0,
        reason,
        notes,
      });
      await base44.stock.adjustProductStock({
        productId: selectedProduct.id,
        delta: -(parseFloat(quantity) || 0),
        unit: selectedProduct.unit,
      });
      await logAction('Baixa de Estoque', `${selectedProduct.name}: ${quantity} (${reason})`);
      onSave?.();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao registrar baixa', description: err.message });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardMinus className="w-5 h-5 text-red-500" /> Baixa de Estoque
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Produto *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock_quantity || 0} em estoque)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade *{selectedProduct?.unit ? ` (${selectedProduct.unit})` : ''}</Label>
            <Input type="number" step="0.01" max={selectedProduct?.stock_quantity || 999} required value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} placeholder="Opcional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !productId || !reason} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Baixa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}