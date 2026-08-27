import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cart from '@/pages/client/Cart';

export default function CartOverlay() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('cart-overlay-open');
    return () => document.body.classList.remove('cart-overlay-open');
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-slate-950/30"
      onClick={() => navigate(-1)}
    >
      <div className="h-full w-full max-w-[min(94vw,520px)] bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <Cart />
      </div>
    </div>
  );
}
