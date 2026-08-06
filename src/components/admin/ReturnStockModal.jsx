import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const RETURN_REASONS = [
  'Pedido cancelado',
  'Devolução de cliente',
  'Erro de venda',
  'Ajuste de inventário',
  'Outro',
];

export default function ReturnStockModal({ open, onClose, products = [], onSave }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProductId('');
      setQuantity('');
      setReason(RETURN_REASONS[0]);
      setNotes('');
    }
  }, [open]);

  const selectedProduct = products.find((p) => p.id === productId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const qty = Number(quantity || 0);
    if (!selectedProduct || !qty || qty <= 0) {
      toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'Informe um produto e uma quantidade maior que zero.' });
      return;
    }

    setSaving(true);
    try {
      await base44.stock.adjustProductStock({ productId, delta: qty, unit: selectedProduct.unit });
      await logAction('Estoque Devolvido', `${selectedProduct.name}: +${qty} ${selectedProduct.unit || ''} - ${reason}${notes ? ` | ${notes}` : ''}`);
      onSave?.();
      onClose();
      toast({ title: 'Estoque devolvido', description: `Foram adicionadas ${qty} ${selectedProduct.unit || ''} de ${selectedProduct.name}.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao devolver estoque', description: err.message || 'Tente novamente.' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-500" /> Devolver ao Estoque
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Produto *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.stock_quantity || 0} {product.unit || 'un'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
              placeholder="Quantidade a devolver"
            />
          </div>
          <div>
            <Label>Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((reasonOption) => (
                  <SelectItem key={reasonOption} value={reasonOption}>{reasonOption}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Opcional"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !productId || !quantity}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Devolver ao Estoque'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
