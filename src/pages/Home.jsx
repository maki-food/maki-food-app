import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

// Antes esta tela fazia sua PRÓPRIA chamada base44.auth.me() (redundante:
// o AuthProvider, que já envolve toda a árvore, já tinha acabado de checar
// a sessão para liberar a rota) e mostrava um segundo spinner enquanto
// esperava essa segunda checagem terminar — daí o "bolinha, logo, bolinha
// de novo" que aparecia na entrada do app. Agora só lê o resultado que já
// existe em contexto e redireciona na hora, sem nova chamada de rede e
// sem tela de carregamento própria.
export default function Home() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/loja" replace />;
  if (user.role === 'admin' || user.role === 'seller') return <Navigate to="/admin" replace />;
  if (user.role === 'deliverer') return <Navigate to="/admin/entregas" replace />;
  return <Navigate to="/loja" replace />;
}
