import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Plus, Trash2, CreditCard, Truck } from 'lucide-react';

export default function CommercialTab() {
  const { settings, refresh } = useSettings();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentFees, setPaymentFees] = useState({});
  const [shippingFee, setShippingFee] = useState(20);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(200);
  const [pickupAddress, setPickupAddress] = useState('');
  const [newMethod, setNewMethod] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setPaymentMethods(settings.payment_methods || ['Pix', 'Dinheiro']);
      setPaymentFees(settings.payment_fees || {});
      setShippingFee(settings.shipping_fee ?? 20);
      setFreeShippingThreshold(settings.free_shipping_threshold ?? 200);
      setPickupAddress(settings.pickup_address || '');
    }
  }, [settings]);

  const addMethod = () => {
    const m = newMethod.trim();
    if (m && !paymentMethods.includes(m)) {
      setPaymentMethods([...paymentMethods, m]);
      setPaymentFees(prev => ({ ...prev, [m]: 0 }));
      setNewMethod('');
    }
  };

  const removeMethod = (method) => {
    setPaymentMethods(paymentMethods.filter(m => m !== method));
    setPaymentFees(prev => { const next = { ...prev }; delete next[method]; return next; });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, {
          payment_methods: paymentMethods,
          payment_fees: paymentFees,
          shipping_fee: shippingFee,
          free_shipping_threshold: freeShippingThreshold,
          pickup_address: pickupAddress.trim(),
        });
      } else {
        await base44.entities.AppSettings.create({
          app_name: 'Maki Food - Tudo Para Seu Restaurante',
          payment_methods: paymentMethods,
          payment_fees: paymentFees,
          shipping_fee: shippingFee,
          free_shipping_threshold: freeShippingThreshold,
          pickup_address: pickupAddress.trim(),
        });
      }
      await logAction('Configurações Comerciais Atualizadas', `Pagamentos: ${paymentMethods.length}, Frete: ${shippingFee}, Grátis acima de: ${freeShippingThreshold}`);
      refresh();
    } catch {}
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Formas de Pagamento</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">Gerencie as formas de pagamento disponíveis no checkout do cliente</p>
        <div className="mb-3 space-y-2">
          {paymentMethods.map(method => (
            <div key={method} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
              <span className="min-w-[110px] text-slate-700">{method}</span>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="100" step="0.01" value={paymentFees[method] ?? 0} onChange={e => setPaymentFees(prev => ({ ...prev, [method]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} className="h-8 w-24 bg-white" />
                <span className="text-xs text-slate-500">% de taxa</span>
              </div>
              <button type="button" onClick={() => removeMethod(method)} className="ml-auto text-slate-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {paymentMethods.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma forma de pagamento cadastrada</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={newMethod}
            onChange={e => setNewMethod(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMethod(); } }}
            placeholder="Nova forma de pagamento..."
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={addMethod}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Configurações de Frete</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Valor do Frete (R$)</Label>
            <Input type="number" min="0" step="0.01" value={shippingFee} onChange={e => setShippingFee(parseFloat(e.target.value) || 0)} className="mt-1" />
            <p className="text-xs text-slate-400 mt-1">Taxa fixa de entrega por pedido</p>
          </div>
          <div>
            <Label>Frete Grátis a partir de (R$)</Label>
            <Input type="number" min="0" step="0.01" value={freeShippingThreshold} onChange={e => setFreeShippingThreshold(parseFloat(e.target.value) || 0)} className="mt-1" />
            <p className="text-xs text-slate-400 mt-1">Pedidos acima deste valor não pagam frete</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Retirada no estabelecimento</h3>
        </div>
        <Label>Endereço para retirada</Label>
        <Input value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} className="mt-1" placeholder="Rua, número, bairro, cidade - UF" />
        <p className="text-xs text-slate-400 mt-1">Esse endereço aparecerá para o cliente no momento de finalizar o pedido.</p>
      </div>

      <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Salvar Configurações
      </Button>
    </form>
  );
}