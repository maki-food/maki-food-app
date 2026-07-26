import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, Search, User } from 'lucide-react';
import ListIcon from '@/components/client/ListIcon';

const items = [
  { to: '/loja', label: 'Início', icon: Home, end: true },
  { to: '/loja/categorias', label: 'Categorias', icon: LayoutGrid },
  { to: '/loja/buscar', label: 'Pesquisar', icon: Search },
  { to: '/loja/listas', label: 'Listas', icon: ListIcon, isList: true },
  { to: '/loja/conta', label: 'Conta', icon: User },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-7xl mx-auto grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, end, isList }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              isList ? (
                <>
                  <Icon className="w-5 h-5" filled={isActive} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              ) : (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'fill-emerald-100' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              )
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
