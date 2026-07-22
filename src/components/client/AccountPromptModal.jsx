import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import { useCart } from '@/context/CartContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

const SEEN_KEY = 'seenAccountPrompt';

/**
 * Popup "Já tem uma conta?" — aparece uma vez, na primeira vez que um
 * visitante (não logado) adiciona um produto ao carrinho.
 */
export default function AccountPromptModal() {
  const { count } = useCart();
  const [user, setUser] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(count);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user && count > prevCount && !localStorage.getItem(SEEN_KEY)) {
      setOpen(true);
      localStorage.setItem(SEEN_KEY, '1');
    }
    setPrevCount(count);
  }, [count, user]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xs text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
          <ShoppingCart className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="font-bold text-slate-900 text-lg">Já tem uma conta?</h3>
        <p className="text-sm text-slate-500">
          Se já adicionou produtos à sua conta, lembre-se de fazer login para não os perder.
        </p>
        <Link to="/login" className="w-full">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700">Entrar</Button>
        </Link>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600 mt-1">
          Agora não
        </button>
      </DialogContent>
    </Dialog>
  );
}
