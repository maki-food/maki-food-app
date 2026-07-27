import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useSettings } from '@/context/SettingsContext';
import { ChevronDown, HelpCircle, LogOut, User } from 'lucide-react';

export default function DesktopAccountMenu() {
  const [user, setUser] = useState(undefined);
  const [accountName, setAccountName] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    base44.auth.me()
      .then((currentUser) => {
        if (!isMounted) return;
        setUser(currentUser);
        if (!currentUser) {
          setAccountName(null);
          return null;
        }
        return base44.entities.Restaurant.filter({ user_id: currentUser.id });
      })
      .then((rests) => {
        if (!isMounted) return;
        setAccountName(Array.isArray(rests) && rests.length > 0 ? rests[0]?.account_name || null : null);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        setAccountName(null);
      });

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openWhatsApp = () => {
    if (settings?.whatsapp_number) {
      window.open(`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`, '_blank');
    }
  };

  const displayName = accountName || (user?.full_name ? user.full_name.split(' ')[0] : 'Minha Conta');

  const handleLogout = () => {
    const cartBackup = localStorage.getItem('cart');
    localStorage.clear();
    sessionStorage.clear();
    if (cartBackup) localStorage.setItem('cart', cartBackup);
    window.location.href = '/login';
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-black/5"
      >
        {user ? `Olá, ${displayName}` : 'Conecte-se'}
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {user === undefined ? (
            <div className="p-6 text-center text-sm text-slate-400">Carregando...</div>
          ) : user ? (
            <>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{accountName || user.full_name || 'Minha Conta'}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100">
                <button onClick={() => { setOpen(false); navigate('/loja/conta'); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                  Minha conta
                </button>
                <button onClick={() => { setOpen(false); navigate('/loja/pedidos'); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                  Meus pedidos
                </button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100">
                  <LogOut className="w-3.5 h-3.5" /> Sair
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-5">
                <p className="font-bold text-slate-900 text-lg">Convidado</p>
                <Link to="/login" onClick={() => setOpen(false)}>
                  <button className="w-full h-11 mt-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm">
                    Entrar
                  </button>
                </Link>
              </div>
              <button onClick={openWhatsApp} className="w-full text-left px-5 py-3 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
                <HelpCircle className="w-4 h-4 text-slate-400" /> Ajuda
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
