import React from 'react';
import { CheckCircle, Truck, Clock } from 'lucide-react';

const config = {
  'Pedido Emitido': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
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