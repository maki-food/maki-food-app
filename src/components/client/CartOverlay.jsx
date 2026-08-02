import React from 'react';
import { useNavigate } from 'react-router-dom';
import Cart from '@/pages/client/Cart';

export default function CartOverlay() {
  const navigate = useNavigate();

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
