import React, { useState } from 'react';
import BrandingTab from '@/components/admin/settings/BrandingTab';
import CommercialTab from '@/components/admin/settings/CommercialTab';
import StaffTab from '@/components/admin/settings/StaffTab';
import ClientsTab from '@/components/admin/settings/ClientsTab';
import AuditLogTab from '@/components/admin/settings/AuditLogTab';
import { Palette, DollarSign, Users, Store, ScrollText } from 'lucide-react';

const tabs = [
  { id: 'branding', label: 'Aparência', icon: Palette, component: BrandingTab },
  { id: 'commercial', label: 'Comercial', icon: DollarSign, component: CommercialTab },
  { id: 'staff', label: 'Usuários', icon: Users, component: StaffTab },
  { id: 'clients', label: 'Clientes', icon: Store, component: ClientsTab },
  { id: 'audit', label: 'Auditoria', icon: ScrollText, component: AuditLogTab },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('branding');
  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Gerencie as configurações do seu sistema</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}