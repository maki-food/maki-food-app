export const permissionGroups = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products_view', label: 'Produtos (Visualizar)' },
  { key: 'products_manage', label: 'Produtos (Editar)' },
  { key: 'variations', label: 'Variações' },
  { key: 'stock_view', label: 'Estoque (Visualizar)' },
  { key: 'stock_writeoff', label: 'Estoque (Lançar Baixa)' },
  { key: 'stock_edit', label: 'Estoque (Editar)' },
  { key: 'purchases', label: 'Compras' },
  { key: 'categories', label: 'Categorias' },
  { key: 'promotions', label: 'Promoções do Dia' },
  { key: 'recipe', label: 'Ficha Técnica' },
  { key: 'expirations', label: 'Validades' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'deliveries', label: 'Entregas' },
  { key: 'settings', label: 'Configurações' },
  { key: 'cash_flow', label: 'Fluxo de Caixa' },
];

const staffDefaults = permissionGroups.reduce((permissions, item) => {
  permissions[item.key] = true;
  return permissions;
}, {});

export const defaultPermissions = {
  admin: { ...staffDefaults },
  seller: { ...staffDefaults, settings: false, deliveries: false },
  deliverer: { deliveries: true },
  user: {},
};

export function getPermissions(user) {
  if (!user) return {};
  if (user.role === 'admin') return defaultPermissions.admin;
  return { ...(defaultPermissions[user.role] || {}), ...(user.permissions || {}) };
}

export function hasPermission(user, permission) {
  return getPermissions(user)[permission] === true;
}
