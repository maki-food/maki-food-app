import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';

export default function Home() {
  const [redirect, setRedirect] = useState(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me()
      .then(user => {
        if (user.role === 'admin' || user.role === 'seller') {
          setRedirect('/admin');
        } else if (user.role === 'deliverer') {
          setRedirect('/admin/entregas');
        } else {
          setRedirect('/loja');
        }
      })
      .catch(() => setRedirect('/loja'));
  }, []);

  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );
}