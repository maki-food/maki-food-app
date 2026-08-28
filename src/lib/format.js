export const formatBRL = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatDateShort = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
};

export const getOrderItemQuantity = (item) => {
  const weightValue = item.weight_kg != null && item.weight_kg !== '' ? Number(item.weight_kg) : null;
  const quantityValue = Number(item.quantity || 0);
  if (weightValue != null && item.weight_per_unit_kg != null && item.weight_per_unit_kg !== '') {
    return weightValue;
  }
  return quantityValue;
};

export const getOrderItemQuantityLabel = (item) => {
  const weightValue = item.weight_kg != null && item.weight_kg !== '' ? Number(item.weight_kg) : null;
  const quantityValue = Number(item.quantity || 0);
  const unit = item.unit || '';
  if (weightValue != null && item.weight_per_unit_kg != null && item.weight_per_unit_kg !== '') {
    return `${weightValue} kg`;
  }
  if (unit && ['kg', 'g', 'litro', 'L', 'mL'].includes(unit)) {
    return `${quantityValue} ${unit}`;
  }
  return `${quantityValue}`;
};

export const getOrderItemSubtotal = (item) => {
  return (item.price || 0) * getOrderItemQuantity(item);
};

export const getOrderDisplayItems = (order) => {
  const items = Array.isArray(order.items) ? [...order.items] : [];
  const shippingFee = Number(order.shipping_fee || 0);
  if (shippingFee <= 0) {
    return items;
  }
  const shippingItem = {
    product_id: null,
    product_name: 'Frete',
    barcode: '',
    quantity: 1,
    price: shippingFee,
    variant_id: null,
    variant_name: null,
    unit: null,
    isShippingItem: true,
  };
  return [...items, shippingItem];
};

export const printOrder = (order, settings = {}) => {
  const displayItems = getOrderDisplayItems(order);
  const isPickupOrder = order.delivery_type === 'pickup'
    || (settings.pickup_address && order.delivery_address === settings.pickup_address);
  const itemsHTML = displayItems.map(item => {
    const quantityText = getOrderItemQuantityLabel(item);
    const raw = formatBRL(getOrderItemSubtotal(item));
    const num = raw.replace('R$', '').trim();
    return `
    <tr>
      <td style="padding:6px;border:1px solid #eee">${item.product_name}</td>
      <td style="padding:6px;border:1px solid #eee;text-align:center">${quantityText}</td>
      <td style="padding:6px;border:1px solid #eee">${item.barcode || '-'}</td>
      <td style="padding:6px;border:1px solid #eee;text-align:right"><span class="money-symbol">R$</span><span class="mono-number">${num}</span></td>
    </tr>`
  }).join('');

  const headerText = settings.invoice_header_text || 'Comprovante de Pedido';
  const footerText = settings.invoice_footer_text || '';
  const logoUrl = settings.invoice_logo_url || settings.logo_url || '';
  const appName = settings.app_name || 'SushiPro Suprimentos';

  const buildCopy = () => `
    <div class="copy">
      <div style="text-align:left;margin-bottom:20px;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="width:96px;height:96px;border-radius:16px;object-fit:cover;display:block;margin:0 auto 16px" />` : `<div style="width:96px;height:96px;background:#059669;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><span style="color:white;font-size:36px;font-weight:bold">${appName.charAt(0) || 'S'}</span></div>`}
        <p style="color:#111;margin:0;font-size:16px;font-weight:600;white-space:pre-wrap;">${headerText}</p>
      </div>
      <table style="width:100%;font-size:12px;margin-bottom:8px;border-collapse:collapse;">
        <tr><td style="width:120px;padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">Restaurante:</td><td style="padding:1px 0;color:#222">${order.restaurant_name}</td></tr>
        <tr><td style="padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">Nota fiscal:</td><td style="padding:1px 0;color:#222">${order.invoice_number || '-'}</td></tr>
        <tr><td style="padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">Data:</td><td style="padding:1px 0;color:#222">${formatDate(order.created_date)}</td></tr>
        <tr><td style="padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">${isPickupOrder ? 'Local de retirada:' : 'Endereço de entrega:'}</td><td style="padding:1px 0;color:#222">${isPickupOrder ? 'RETIRADA NA LOJA' : order.delivery_address}</td></tr>
        <tr><td style="padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">Pagamento:</td><td style="padding:1px 0;color:#222">${order.payment_method}</td></tr>
        <tr><td style="padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">Contato:</td><td style="padding:1px 0;color:#222">${order.contact_info || '-'}</td></tr>
        <tr><td style="padding:1px 2px 1px 0;font-weight:600;color:#444;vertical-align:top">Observações:</td><td style="padding:1px 0;color:#222;white-space:pre-wrap">${order.observations || '-'}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f0fdf4"><th style="border:1px solid #ddd;padding:6px;text-align:left">Produto</th><th style="border:1px solid #ddd;padding:6px;text-align:center">Qtd</th><th style="border:1px solid #ddd;padding:6px;text-align:left">Código</th><th style="border:1px solid #ddd;padding:6px;text-align:right">Subtotal</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end">
        <div style="width:180px;text-align:right;font-size:13px;margin-top:12px;color:#000;font-family:Arial, sans-serif">
          <p style="margin:0">Subtotal: <span class="money-symbol">R$</span><span class="mono-number">${formatBRL((order.total || 0) - (order.shipping_fee || 0)).replace('R$', '').trim()}</span></p>
          <p style="margin:0">Frete: ${(order.shipping_fee || 0) > 0 ? `<span class=\"money-symbol\">R$</span><span class=\"mono-number\">${formatBRL(order.shipping_fee).replace('R$', '').trim()}</span>` : 'Grátis'}</p>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <div style="width:180px;text-align:right;font-size:15px;margin-top:4px"><strong><span class="money-symbol">R$</span><span class="mono-number">${formatBRL(order.total).replace('R$', '').trim()}</span></strong></div>
      </div>
      ${footerText ? `<p style="text-align:left;color:#999;font-size:11px;margin:8px 0 0;white-space:pre-wrap">${footerText}</p>` : ''}
    </div>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Permita popups para imprimir o pedido.'); return; }
  w.document.write(`<html><head><title>Pedido - ${order.restaurant_name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto;color:#000}.copy{page-break-after:always}.copy:last-child{page-break-after:auto}.mono-number{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace; font-variant-numeric: tabular-nums; -webkit-font-feature-settings: "tnum" 1; font-feature-settings: "tnum" 1; display:inline-block; text-align:right;color:#000}.money-symbol{color:#000;margin-right:6px}.table-money{white-space:nowrap;color:#000}</style></head><body>${buildCopy()}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
};