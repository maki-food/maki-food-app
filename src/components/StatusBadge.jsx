import React from 'react';
import { CheckCircle, Truck, Clock, Package } from 'lucide-react';

const config = {
  'Pedido Emitido': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  'Em Separação': { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Package },
  'Pronto para Retirada': { color: 'bg-green-100 text-green-700 border-green-200', icon: Package },
  'Com Entregador': { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Truck },
  'Saiu para Entrega': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Truck },
  'Finalizado': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
};

export default function StatusBadge({ status }) {
  const c = config[status] || config['Pedido Emitido'];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}