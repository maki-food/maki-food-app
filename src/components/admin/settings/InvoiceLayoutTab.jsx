import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { logAction } from '@/lib/audit';
import { optimizeImage } from '@/lib/imageUpload';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, X, ImageIcon, FileText } from 'lucide-react';

const exampleItems = [
  { name: 'Nori a', quantity: 2, price: 18, barcode: '-' },
  { name: 'Nori d', quantity: 2, price: 18, barcode: '-' },
  { name: 'Salmão Inteiro', quantity: 2, price: 200, barcode: '123456789' },
  { name: 'Nori c', quantity: 1, price: 10, barcode: '-' },
  { name: 'Nori b', quantity: 1, price: 15, barcode: '-' },
  { name: 'Alga Nori', quantity: 1, price: 10, barcode: '-' },
  { name: 'Vinagre de Arroz 20L', quantity: 1, price: 40, barcode: '-' },
];

const exampleOrder = {
  restaurant_name: 'kembu',
  created_date: '2026-08-01T12:16:00.000Z',
  delivery_address: 'Rua H, 105, casa, Vila Esportiva, Vespasiano, MG, 33202-392',
  payment_method: 'Dinheiro',
  contact_info: '(31) 99999-9999',
  observations: 'nada nao',
  shipping_fee: 0,
  total: exampleItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
};

export default function InvoiceLayoutTab() {
  const { settings, refresh } = useSettings();
  const [form, setForm] = useState({
    invoice_logo_url: '',
    invoice_header_text: 'Comprovante de Pedido',
    invoice_footer_text: 'Via 1 - Cliente',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        invoice_logo_url: settings.invoice_logo_url || '',
        invoice_header_text: settings.invoice_header_text || 'Comprovante de Pedido',
        invoice_footer_text: settings.invoice_footer_text || 'Via 1 - Cliente',
      });
    }
  }, [settings]);

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeImage(file, 1000);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
      setForm(prev => ({ ...prev, invoice_logo_url: file_url }));
    } catch (error) {
      console.error('Erro ao enviar logo da nota fiscal:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setForm(prev => ({ ...prev, invoice_logo_url: '' }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        app_name: settings?.app_name || 'SushiPro',
        invoice_logo_url: form.invoice_logo_url,
        invoice_header_text: form.invoice_header_text,
        invoice_footer_text: form.invoice_footer_text,
      };

      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, payload);
      } else {
        await base44.entities.AppSettings.create(payload);
      }
      await logAction('Layout de Nota Fiscal Atualizado', `Topo e rodapé da nota fiscal atualizados`);
      refresh();
    } catch (error) {
      console.error('Erro ao salvar layout da nota fiscal:', error, error?.data || error?.message);
      alert(`Erro ao salvar layout da nota fiscal: ${error?.message || 'verifique o console'}`);
    } finally {
      setSaving(false);
    }
  };

  const total = exampleOrder.total;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-1/2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-slate-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pré-visualização da Nota Fiscal</h2>
              <p className="text-sm text-slate-500">Veja como a nota será impressa com suas configurações.</p>
            </div>
          </div>

          <div className="mx-auto max-w-[520px] min-h-[740px] rounded-[32px] border border-slate-300 bg-slate-200 p-6 shadow-lg">
            <div className="h-full rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="px-10 pt-10 pb-6 border-b border-slate-200">
                <div className="w-full flex justify-center mb-4">
                  <div className="w-36 h-36 rounded-3xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                    {form.invoice_logo_url ? (
                      <img src={form.invoice_logo_url} alt="Logo NF" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                </div>
                {form.invoice_header_text ? (
                  <p className="text-sm text-slate-500 mt-2 whitespace-pre-wrap break-words w-full text-left">{form.invoice_header_text}</p>
                ) : (
                  <div className="h-5 mt-5" />
                )}
              </div>

              <div className="flex-1 p-6 text-sm text-slate-600 space-y-3">
                <div className="grid grid-cols-[100px_1fr] gap-x-1 gap-y-1 text-left text-[13px]">
                  <span className="text-slate-500 font-medium whitespace-nowrap pr-1">Restaurante:</span>
                  <span className="text-slate-900">{exampleOrder.restaurant_name}</span>
                  <span className="text-slate-500 font-medium whitespace-nowrap pr-1">Data:</span>
                  <span className="text-slate-900">{formatDate(exampleOrder.created_date)}</span>
                  <span className="text-slate-500 font-medium whitespace-nowrap pr-1">Endereço:</span>
                  <span className="text-slate-900">{exampleOrder.delivery_address}</span>
                  <span className="text-slate-500 font-medium whitespace-nowrap pr-1">Pagamento:</span>
                  <span className="text-slate-900">{exampleOrder.payment_method}</span>
                  <span className="text-slate-500 font-medium whitespace-nowrap pr-1">Contato:</span>
                  <span className="text-slate-900">{exampleOrder.contact_info}</span>
                  <span className="text-slate-500 font-medium whitespace-nowrap pr-1">Observações:</span>
                  <span className="text-slate-900">{exampleOrder.observations}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
                    <table className="w-full text-sm text-slate-700 border-separate border-spacing-0">
                      <thead className="bg-emerald-50 text-slate-600 text-[12px] uppercase tracking-wide border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Produto</th>
                          <th className="px-3 py-2 text-center">Qtd</th>
                          <th className="px-3 py-2 text-left">Código</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exampleItems.map((item, index) => (
                          <tr key={index} className={index < exampleItems.length - 1 ? 'border-b border-slate-100' : ''}>
                            <td className="px-3 py-3 text-slate-900">{item.name}</td>
                            <td className="px-3 py-3 text-center text-slate-900">{item.quantity}</td>
                            <td className="px-3 py-3 text-slate-900">{item.barcode}</td>
                            <td className="px-3 py-3 text-right text-slate-900">
                              <span className="text-slate-700 mr-1">R$</span>
                              <span className="font-mono">{(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <div className="w-44 text-right text-slate-700 space-y-1 text-[13px]">
                      <p>Subtotal: <span className="font-semibold text-slate-900"><span className="text-slate-700 mr-1">R$</span><span className="font-mono">{((total) - (exampleOrder.shipping_fee || 0)).toFixed(2).replace('.', ',')}</span></span></p>
                      <p>Frete: <span className="font-semibold text-slate-900">Grátis</span></p>
                      <p className="text-base font-semibold text-slate-900">Total: <span className="text-slate-700 mr-1">R$</span><span className="font-mono">{total.toFixed(2).replace('.', ',')}</span></p>
                    </div>
                  </div>
                </div>

              <div className="px-10 pt-6 border-t border-slate-200 text-left text-xs text-slate-500">
                {form.invoice_footer_text ? (
                  <p className="whitespace-pre-wrap">{form.invoice_footer_text}</p>
                ) : (
                  <p className="h-3" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-1/2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Editar Layout da Nota Fiscal</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Logo da Nota Fiscal</Label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                    {form.invoice_logo_url ? <img src={form.invoice_logo_url} alt="Logo NF" className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-300" />}
                  </div>
                  {form.invoice_logo_url ? (
                    <button type="button" onClick={removeLogo} className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                      <X className="w-4 h-4" /> Remover logo
                    </button>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Enviando...' : 'Enviar Logo'}
                      <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <Label>Texto do Topo</Label>
                <Textarea value={form.invoice_header_text} onChange={e => setForm(prev => ({ ...prev, invoice_header_text: e.target.value }))} rows={3} className="mt-2" />
              </div>
              <div>
                <Label>Texto do Rodapé</Label>
                <Textarea value={form.invoice_footer_text} onChange={e => setForm(prev => ({ ...prev, invoice_footer_text: e.target.value }))} rows={3} className="mt-2" />
              </div>
              <Button type="button" onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Nota Fiscal'}
              </Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-500">
            <p className="font-semibold text-slate-900 mb-2">Como funciona</p>
            <p>O sistema irá preencher automaticamente os produtos e os dados do pedido.</p>
            <p>Você só precisa personalizar a logo e os textos do topo/rodapé da nota.</p>
            <p>A pré-visualização mostra o formato final da impressão.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
