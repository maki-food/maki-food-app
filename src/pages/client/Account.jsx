import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import ProfileEditDialog from '@/components/client/ProfileEditDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, ClipboardList, UserCog, LogOut, HelpCircle, ShieldCheck, ChevronRight, MessageCircle, MapPin } from 'lucide-react';

export default function Account() {
  const [user, setUser] = useState(undefined);
  const [profileOpen, setProfileOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const { settings } = useSettings();
  const navigate = useNavigate();

  const load = () => base44.auth.me().then(setUser).catch(() => setUser(null));
  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    const cartBackup = localStorage.getItem('cart');
    localStorage.clear();
    sessionStorage.clear();
    if (cartBackup) localStorage.setItem('cart', cartBackup);
    window.location.href = '/login';
  };

  const openWhatsApp = () => {
    if (settings?.whatsapp_number) {
      const digits = settings.whatsapp_number.replace(/\D/g, '');
      window.open(`https://wa.me/${digits}`, '_blank');
    } else {
      alert('Nenhum WhatsApp de atendimento configurado ainda.');
    }
  };

  if (user === undefined) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Convidado</h1>
        <p className="text-sm text-slate-400 mb-8">Entre pra acompanhar seus pedidos e endereços</p>

        <div className="bg-slate-50 rounded-2xl p-6 text-center mb-6">
          <p className="text-sm text-slate-600 mb-4">
            Para comprar,você precisa de uma conta, para que possa fazer as suas compras em menos tempo e também possamos fornecer um serviço melhor.
          </p>
          <Link to="/login">
            <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-semibold">Entrar</Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          <button onClick={openWhatsApp} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
            <HelpCircle className="w-5 h-5 text-slate-400" />
            <span className="flex-1 font-medium text-slate-700">Ajuda</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => setPrivacyOpen(true)} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
            <span className="flex-1 font-medium text-slate-700">Privacidade e dados</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900">{user.full_name || 'Minha Conta'}</p>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 mb-4">
        <button onClick={() => navigate('/loja/pedidos')} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
          <ClipboardList className="w-5 h-5 text-slate-400" />
          <span className="flex-1 font-medium text-slate-700">Meus pedidos</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={() => setProfileOpen(true)} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
          <UserCog className="w-5 h-5 text-slate-400" />
          <span className="flex-1 font-medium text-slate-700">Dados pessoais</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={() => setProfileOpen(true)} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
          <MapPin className="w-5 h-5 text-slate-400" />
          <span className="flex-1 font-medium text-slate-700">Endereços</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={openWhatsApp} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
          <HelpCircle className="w-5 h-5 text-slate-400" />
          <span className="flex-1 font-medium text-slate-700">Ajuda</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={() => setPrivacyOpen(true)} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 text-left">
          <ShieldCheck className="w-5 h-5 text-slate-400" />
          <span className="flex-1 font-medium text-slate-700">Privacidade e dados</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-200 text-red-600 font-medium hover:bg-red-50">
        <LogOut className="w-4 h-4" /> Sair
      </button>

      <ProfileEditDialog open={profileOpen} onClose={() => setProfileOpen(false)} user={user} onSaved={load} />
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}

function PrivacyDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Privacidade e Dados</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-600 space-y-3">
          <p>Seus dados (nome, endereço, telefone e histórico de pedidos) são usados só pra processar suas compras e melhorar seu atendimento.</p>
          <p>Não vendemos nem compartilhamos suas informações com terceiros fora do necessário pra entrega do seu pedido.</p>
          <p>Pra dúvidas ou pra pedir a exclusão dos seus dados, entra em contato pelo WhatsApp de atendimento.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
