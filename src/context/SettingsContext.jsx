import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { hexToHsl, darken } from '@/lib/audit';

const SettingsContext = createContext(null);
export const useSettings = () => useContext(SettingsContext);

const DEFAULTS = { app_name: 'SushiPro', logo_url: '', hero_image_url: '', hero_image_mobile_url: '', banners: [], desktop_banners: [], mobile_banners: [], banner_interval: 5, sidebar_bg: '#0f172a', primary_color: '#059669', page_bg: '#f8fafc', topbar_bg: '#ffffff', category_bar_bg: '#f8fafc', admin_text_color: '#ffffff', store_text_color: '#475569', cart_card_bg: '#059669', cart_card_text: '#ffffff', cart_button_bg: '#ffffff', cart_button_text: '#047857', invoice_logo_url: '', invoice_header_text: 'Comprovante de Pedido', invoice_footer_text: '', expiration_threshold_days: 7, payment_methods: ['Pix', 'Dinheiro'], shipping_fee: 20, free_shipping_threshold: 200 };

const normalizeAppSettings = (raw) => {
  if (!raw) return DEFAULTS;
  const banners = raw.banners || [];
  const desktop_banners = (raw.desktop_banners && raw.desktop_banners.length > 0) ? raw.desktop_banners : banners;
  const mobile_banners = raw.mobile_banners || [];

  return {
    ...DEFAULTS,
    ...raw,
    banners,
    desktop_banners,
    mobile_banners,
    banner_interval: raw.banner_interval ?? DEFAULTS.banner_interval,
  };
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);

  const loadSettings = async () => {
    try {
      const list = await base44.entities.AppSettings.list();
      setSettings(list.length > 0 ? normalizeAppSettings(list[0]) : DEFAULTS);
    } catch (error) {
      console.error('Erro ao carregar AppSettings:', error);
      setSettings(DEFAULTS);
    }
  };

  useEffect(() => {
    loadSettings();
    const unsub = base44.entities.AppSettings.subscribe(() => loadSettings());
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.style.setProperty('--sidebar-background', hexToHsl(settings.sidebar_bg || DEFAULTS.sidebar_bg));
    root.style.setProperty('--primary', hexToHsl(settings.primary_color || DEFAULTS.primary_color));
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    root.style.setProperty('--background', hexToHsl(settings.page_bg || DEFAULTS.page_bg));
    document.title = `${settings.app_name || 'SushiPro'} - Suprimentos para Sushi`;

    let style = document.getElementById('dynamic-theme');
    if (!style) {
      style = document.createElement('style');
      style.id = 'dynamic-theme';
      document.head.appendChild(style);
    }
    const primary = settings.primary_color || DEFAULTS.primary_color;
    style.textContent = `
      .bg-emerald-600 { background-color: ${primary} !important; }
      .hover\\:bg-emerald-700:hover { background-color: ${darken(primary)} !important; }
    `;
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, refresh: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};