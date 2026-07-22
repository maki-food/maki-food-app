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

export const printOrder = (order) => {
  const itemsHTML = (order.items || []).map(item => `
    <tr>
      <td>${item.product_name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td>${item.barcode || '-'}</td>
      <td style="text-align:right">${formatBRL((item.price || 0) * item.quantity)}</td>
    </tr>`).join('');

  const buildCopy = (label) => `
    <div class="copy">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:32px;height:32px;background:#059669;border-radius:8px;display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-size:18px;font-weight:bold">S</span>
        </div>
        <div>
          <h1 style="margin:0;font-size:18px">SushiPro Suprimentos</h1>
          <p style="color:#666;margin:0;font-size:12px">Comprovante de Pedido</p>
        </div>
      </div>
      <table style="width:100%;font-size:13px;margin:12px 0">
        <tr><td style="padding:2px 0"><strong>Restaurante:</strong></td><td>${order.restaurant_name}</td></tr>
        <tr><td style="padding:2px 0"><strong>Data:</strong></td><td>${formatDate(order.created_date)}</td></tr>
        <tr><td style="padding:2px 0"><strong>Endereço:</strong></td><td>${order.delivery_address}</td></tr>
        <tr><td style="padding:2px 0"><strong>Pagamento:</strong></td><td>${order.payment_method}</td></tr>
        <tr><td style="padding:2px 0"><strong>Contato:</strong></td><td>${order.contact_info || '-'}</td></tr>
        <tr><td style="padding:2px 0"><strong>Observações:</strong></td><td>${order.observations || '-'}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f0fdf4"><th style="border:1px solid #ddd;padding:6px;text-align:left">Produto</th><th style="border:1px solid #ddd;padding:6px">Qtd</th><th style="border:1px solid #ddd;padding:6px">Código</th><th style="border:1px solid #ddd;padding:6px;text-align:right">Subtotal</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      ${(order.shipping_fee || 0) > 0 ? `<p style="text-align:right;font-size:13px;margin-top:8px;color:#666">Subtotal: ${formatBRL((order.total || 0) - (order.shipping_fee || 0))}</p><p style="text-align:right;font-size:13px;color:#666">Frete: ${formatBRL(order.shipping_fee)}</p>` : ''}
      <p style="text-align:right;font-size:15px;margin-top:4px"><strong>Total: ${formatBRL(order.total)}</strong></p>
      <hr style="border:none;border-top:1px dashed #ccc;margin:14px 0">
      <p style="text-align:center;color:#999;font-size:11px">${label}</p>
    </div>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Permita popups para imprimir o pedido.'); return; }
  w.document.write(`<html><head><title>Pedido - ${order.restaurant_name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto}.copy{page-break-after:always}.copy:last-child{page-break-after:auto}</style></head><body>${buildCopy('Via 1 - Cliente')}${buildCopy('Via 2 - Loja')}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
};