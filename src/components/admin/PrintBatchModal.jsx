import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Printer } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * Modal para definir a quantidade de etiquetas a imprimir e enviar para impressora térmica
 * Formato da etiqueta:
 * Produto: [Nome do Produto]
 * Lote: [01-20082026]
 */
export default function PrintBatchModal({ open, onClose, productName, batchNumber, batchDate }) {
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    const qty = parseInt(quantity) || 1;
    if (qty <= 0 || qty > 1000) {
      toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'Digite um número entre 1 e 1000.' });
      return;
    }

    setLoading(true);
    try {
      // Formata o conteúdo da etiqueta
      const etiquetaConteudo = `Produto: ${productName}
Lote: ${batchNumber}-${batchDate}`;

      // Cria um formato para impressora térmica (linha por linha)
      const linhas = [];
      for (let i = 0; i < qty; i++) {
        linhas.push(etiquetaConteudo);
        linhas.push('---'); // Separador entre etiquetas
      }

      const conteudoCompleto = linhas.join('\n');

      // Abre a caixa de diálogo de impressão do navegador
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        throw new Error('Falha ao abrir janela de impressão. Verifique as configurações do navegador.');
      }

      // Escreve o conteúdo de forma legível para impressora térmica
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Imprimir Lotes</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 10px;
              font-size: 12px;
              line-height: 1.4;
            }
            .etiqueta {
              page-break-after: always;
              margin-bottom: 20px;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            @media print {
              body { margin: 0; padding: 5px; }
              .etiqueta { margin-bottom: 10px; }
            }
          </style>
        </head>
        <body>
      `);

      // Adiciona cada etiqueta
      for (let i = 0; i < qty; i++) {
        printWindow.document.write(`
          <div class="etiqueta">
            <strong>Produto:</strong> ${productName}<br>
            <strong>Lote:</strong> ${batchNumber}-${batchDate}
          </div>
        `);
      }

      printWindow.document.write(`
        </body>
        </html>
      `);
      printWindow.document.close();

      // Aguarda o carregamento e abre o diálogo de impressão
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Fecha a janela após impressão ou cancelamento
          printWindow.onafterprint = () => {
            printWindow.close();
          };
        }, 250);
      };

      toast({ title: 'Impressão iniciada', description: `${qty} etiqueta(s) enviada(s) para a impressora.` });
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro na impressão', description: err.message || 'Tente novamente.' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Imprimir Etiquetas de Lote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-slate-700">Produto</Label>
            <div className="mt-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900">
              {productName}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Lote</Label>
            <div className="mt-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 font-mono">
              {batchNumber}-{batchDate}
            </div>
          </div>
          <div>
            <Label htmlFor="qty">Quantidade de Etiquetas *</Label>
            <Input
              id="qty"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
              placeholder="1"
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">Quantas etiquetas deseja imprimir?</p>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Preparando...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
