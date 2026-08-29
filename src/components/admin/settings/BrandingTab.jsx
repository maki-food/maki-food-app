import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Save, ImageIcon, Palette, Type, Plus, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { optimizeImage } from '@/lib/imageUpload';

const ColorField = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
    <Input value={value} onChange={e => onChange(e.target.value)} className="flex-1 font-mono text-sm" />
  </div>
);

export default function BrandingTab() {
  const { settings, refresh } = useSettings();
  const [form, setForm] = useState({ app_name: 'Maki Food - Tudo Para Seu Restaurante', logo_url: '', hero_image_url: '', banners: [], desktop_banners: [], mobile_banners: [], banner_interval: 5, whatsapp_number: '', sidebar_bg: '#0f172a', primary_color: '#059669', page_bg: '#f8fafc', topbar_bg: '#ffffff', category_bar_bg: '#f8fafc', admin_text_color: '#ffffff', store_text_color: '#475569', cart_card_bg: '#059669', cart_card_text: '#ffffff', cart_button_bg: '#ffffff', cart_button_text: '#047857', expiration_threshold_days: 7 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        app_name: settings.app_name || 'Maki Food - Tudo Para Seu Restaurante',
        logo_url: settings.logo_url || '',
        hero_image_url: settings.hero_image_url || '',
        banners: settings.banners || [],
        desktop_banners: settings.desktop_banners || settings.banners || [],
        mobile_banners: settings.mobile_banners || [],
        banner_interval: settings.banner_interval || 5,
        whatsapp_number: settings.whatsapp_number || '',
        sidebar_bg: settings.sidebar_bg || '#0f172a',
        primary_color: settings.primary_color || '#059669',
        page_bg: settings.page_bg || '#f8fafc',
        topbar_bg: settings.topbar_bg || '#ffffff',
        category_bar_bg: settings.category_bar_bg || '#f8fafc',
        admin_text_color: settings.admin_text_color || '#ffffff',
        store_text_color: settings.store_text_color || '#475569',
        cart_card_bg: settings.cart_card_bg || '#059669',
        cart_card_text: settings.cart_card_text || '#ffffff',
        cart_button_bg: settings.cart_button_bg || '#ffffff',
        cart_button_text: settings.cart_button_text || '#047857',
        expiration_threshold_days: settings.expiration_threshold_days || 7,
      });
    }
  }, [settings]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeImage(file, 1000);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
      setForm(prev => ({ ...prev, logo_url: file_url }));
    } catch {}
    setUploading(false);
  };

  const handleBannerUpload = async (e, mode = 'desktop') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const key = mode === 'mobile' ? 'mobile_banners' : 'desktop_banners';
    setUploading(true);
    try {
      const optimized = await Promise.all(files.map(f => optimizeImage(f)));
      const uploaded = await Promise.all(
        optimized.map(file => base44.integrations.Core.UploadFile({ file }))
      );
      const newUrls = uploaded.map(r => r.file_url);
      setForm(prev => ({ ...prev, [key]: [...(prev[key] || []), ...newUrls] }));
    } catch {}
    setUploading(false);
  };

  const removeBanner = (idx, mode = 'desktop') => {
    const key = mode === 'mobile' ? 'mobile_banners' : 'desktop_banners';
    setForm(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx) }));
  };

  const moveBanner = (idx, dir, mode = 'desktop') => {
    const key = mode === 'mobile' ? 'mobile_banners' : 'desktop_banners';
    const newBanners = [...(form[key] || [])];
    const target = idx + dir;
    if (target < 0 || target >= newBanners.length) return;
    [newBanners[idx], newBanners[target]] = [newBanners[target], newBanners[idx]];
    setForm(prev => ({ ...prev, [key]: newBanners }));
  };

  const renderBannerSection = ({ title, subtitle, description, showIcon = true, mode = 'desktop' }) => {
    const key = mode === 'mobile' ? 'mobile_banners' : 'desktop_banners';
    const banners = form[key] || [];

    return (
      <div className="p-5">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2">
            {showIcon ? <ImageIcon className="w-4 h-4 text-slate-400" /> : null}
            {title ? <h3 className="font-semibold text-slate-900">{title}</h3> : null}
          </div>
          {subtitle ? <p className="text-sm font-medium text-slate-600">{subtitle}</p> : null}
        </div>

        <p className="text-xs text-slate-400 mb-3">{description || 'Envie uma ou mais imagens para o carrossel de banners exibido no topo da loja. Recomendado: 1200x400px.'}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {banners.map((url, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[3/1]">
              <img src={url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1">
                <button type="button" onClick={() => moveBanner(idx, -1, mode)} disabled={idx === 0} className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0" title="Mover esquerda">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => moveBanner(idx, 1, mode)} disabled={idx === banners.length - 1} className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0" title="Mover direita">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => removeBanner(idx, mode)} className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-red-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity" title="Remover">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <label className="aspect-[3/1] rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100">
            <div className="text-center">
              <Plus className="w-6 h-6 text-slate-300 mx-auto mb-1" />
              <span className="text-xs text-slate-400">{uploading ? 'Enviando...' : 'Adicionar Banner'}</span>
            </div>
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleBannerUpload(e, mode)} disabled={uploading} />
          </label>
        </div>
      </div>
    );
  };

  const renderBannerPanels = () => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
      {renderBannerSection({
        title: 'Banners da Loja (Carrossel)',
        subtitle: 'Modo Computador',
        description: 'Envie uma ou mais imagens para o carrossel de banners exibido no topo da loja. Recomendado: 1200x400px.',
        showIcon: true,
        mode: 'desktop',
      })}
      {renderBannerSection({
        title: '',
        subtitle: 'Modo Celular',
        description: 'Envie uma ou mais imagens para o carrossel de banners exibido no topo da loja. Recomendado: 500x375px.',
        showIcon: false,
        mode: 'mobile',
      })}
      <div className="p-5 flex items-center gap-3 border-t border-slate-200">
        <Clock className="w-4 h-4 text-slate-400" />
        <Label className="mb-0">Tempo de transição (segundos)</Label>
        <Input type="number" min="2" max="30" value={form.banner_interval} onChange={e => setForm({ ...form, banner_interval: parseInt(e.target.value) || 5 })} className="w-24" />
        <p className="text-xs text-slate-400">Intervalo entre cada slide do carrossel</p>
      </div>
    </div>
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        banners: form.desktop_banners || [],
      };

      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, payload);
      } else {
        await base44.entities.AppSettings.create(payload);
      }
      await logAction('Aparência do Sistema Atualizada', `App: ${form.app_name}, Cor: ${form.primary_color}`);
      refresh();
    } catch (error) {
      console.error('Erro ao salvar AppSettings:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Identidade do App</h3>
        </div>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
            {form.logo_url ? <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
          </div>
          <div>
            <Label>Logo do App</Label>
            <p className="text-xs text-slate-400 mb-2 mt-1">Otimizada automaticamente para carregamento rápido</p>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Enviar Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
          </div>
        </div>
        <div>
          <Label>Nome do App</Label>
          <Input value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} className="mt-1" placeholder="Maki Food - Tudo Para Seu Restaurante" />
          <p className="text-xs text-slate-400 mt-1">Este nome aparece na barra lateral, no cabeçalho da loja e no título do navegador</p>
        </div>
        <div>
          <Label>WhatsApp de Atendimento</Label>
          <Input value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} className="mt-1" placeholder="55119999999999 (com DDI e DDD, só números)" />
          <p className="text-xs text-slate-400 mt-1">Usado no botão "Falar com Atendente" e "Ajuda" na loja do cliente</p>
        </div>
        <div className="mt-4">
          <Label>Dias para Alerta de Validade</Label>
          <Input type="number" min="1" max="90" value={form.expiration_threshold_days} onChange={e => setForm({ ...form, expiration_threshold_days: parseInt(e.target.value) || 7 })} className="mt-1 w-32" />
          <p className="text-xs text-slate-400 mt-1">Produtos dentro deste período aparecem como "Vencendo" no módulo Validades</p>
        </div>
      </div>

      {renderBannerPanels()}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Customização de Cores</h3>
        </div>
        <div className="space-y-5">
          <section className="rounded-lg border border-slate-100 p-4">
            <h4 className="text-sm font-semibold text-slate-800">Painel Admin</h4>
            <p className="mt-1 text-xs text-slate-400">Cores da navegação e dos textos da área de gestão.</p>
            <div className="mt-4 space-y-4">
            <div>
            <Label>Fundo da Barra Lateral</Label>
            <div className="mt-1"><ColorField value={form.sidebar_bg} onChange={v => setForm({ ...form, sidebar_bg: v })} /></div>
          </div>
          <div>
            <Label>Texto do Painel Admin</Label>
            <div className="mt-1"><ColorField value={form.admin_text_color} onChange={v => setForm({ ...form, admin_text_color: v })} /></div>
          </div>
          <div>
            <Label>Cor Primária dos Botões</Label>
            <div className="mt-1"><ColorField value={form.primary_color} onChange={v => setForm({ ...form, primary_color: v })} /></div>
          </div>
          </div>
          </section>

          <section className="rounded-lg border border-slate-100 p-4">
            <h4 className="text-sm font-semibold text-slate-800">Loja do Cliente</h4>
            <p className="mt-1 text-xs text-slate-400">Fundo, topo, categorias e textos vistos pelo cliente.</p>
            <div className="mt-4 space-y-4">
          <div>
            <Label>Fundo das Páginas</Label>
            <div className="mt-1"><ColorField value={form.page_bg} onChange={v => setForm({ ...form, page_bg: v })} /></div>
          </div>
          <div>
            <Label>Fundo do Topo da Loja</Label>
            <div className="mt-1"><ColorField value={form.topbar_bg} onChange={v => setForm({ ...form, topbar_bg: v })} /></div>
          </div>
          <div>
            <Label>Fundo da Barra de Categorias</Label>
            <div className="mt-1"><ColorField value={form.category_bar_bg} onChange={v => setForm({ ...form, category_bar_bg: v })} /></div>
          </div>
          <div>
            <Label>Texto da Logo</Label>
            <div className="mt-1"><ColorField value={form.store_text_color} onChange={v => setForm({ ...form, store_text_color: v })} /></div>
          </div>
          </div>
          </section>

          <section className="rounded-lg border border-slate-100 p-4">
            <h4 className="text-sm font-semibold text-slate-800">Card Previa do Carrinho </h4>
            <p className="mt-1 text-xs text-slate-400">Personalize o card inferior com unidades, preço estimado e acesso ao carrinho.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><Label>Fundo do Card</Label><div className="mt-1"><ColorField value={form.cart_card_bg} onChange={v => setForm({ ...form, cart_card_bg: v })} /></div></div>
              <div><Label>Texto do Card</Label><div className="mt-1"><ColorField value={form.cart_card_text} onChange={v => setForm({ ...form, cart_card_text: v })} /></div></div>
              <div><Label>Fundo do Botão</Label><div className="mt-1"><ColorField value={form.cart_button_bg} onChange={v => setForm({ ...form, cart_button_bg: v })} /></div></div>
              <div><Label>Texto do Botão</Label><div className="mt-1"><ColorField value={form.cart_button_text} onChange={v => setForm({ ...form, cart_button_text: v })} /></div></div>
            </div>
          </section>
        </div>
        <div className="mt-4 p-4 rounded-lg border border-slate-100" style={{ backgroundColor: form.page_bg }}>
          <p className="text-xs text-slate-400 mb-2">Pré-visualização</p>
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: form.primary_color }}>
              Botão Primário
            </div>
            <div className="px-3 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: form.sidebar_bg }}>
              Barra Lateral
            </div>
            <div className="px-3 py-2 rounded-lg text-slate-700 text-sm border border-slate-200" style={{ backgroundColor: form.topbar_bg }}>
              Barra Superior
            </div>
            <div className="px-3 py-2 rounded-lg text-slate-700 text-sm border border-slate-200" style={{ backgroundColor: form.category_bar_bg }}>
              Barra Categorias
            </div>
            <div className="px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: form.sidebar_bg, color: form.admin_text_color }}>
              Texto Admin
            </div>
            <div className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200" style={{ backgroundColor: form.topbar_bg, color: form.store_text_color }}>
              Texto Loja
            </div>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Salvar Configurações
      </Button>
    </form>
  );
}