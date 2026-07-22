import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/supabaseClient';
import ProductCard from '@/components/ProductCard';
import { Heart, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Lists() {
  const [user, setUser] = useState(undefined); // undefined = carregando, null = visitante
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const favs = await base44.entities.Favorite.filter({ user_id: user.id });
        const allProducts = await base44.entities.Product.list();
        const favIds = new Set(favs.map(f => f.product_id));
        setProducts(allProducts.filter(p => favIds.has(p.id)));
      } catch {}
      setLoading(false);
    };
    load();
    const unsub = base44.entities.Favorite.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, [user]);

  if (user === undefined || loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4">
        <div className="w-24 h-24 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
          <Heart className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Entrar para ver suas listas</h1>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">Assim que aceder à sua conta, encontrará todas as suas listas aqui.</p>
        <Link to="/login" className="w-full max-w-xs">
          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700">Entrar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Minhas Listas</h1>
      {products.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Heart className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum produto favoritado ainda</p>
          <p className="text-sm mt-1">Toca no coração de um produto pra guardar aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
}
