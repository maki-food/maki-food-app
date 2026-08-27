import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Não autenticado');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Não autenticado');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !['admin', 'seller'].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await request.json();
    const { delivererId, restaurantName, invoiceNumber, total } = payload;
    if (!delivererId) throw new Error('Entregador não informado');

    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', delivererId);
    if (subscriptionError) throw subscriptionError;

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    );

    const message = JSON.stringify({
      title: 'Nova entrega atribuída!',
      body: `${restaurantName || 'Cliente'} • ${invoiceNumber || 'Pedido'} • R$ ${Number(total || 0).toFixed(2).replace('.', ',')}`,
      url: '/admin/entregas',
      tag: `delivery-${invoiceNumber || delivererId}`,
    });
    const results = await Promise.allSettled((subscriptions || []).map(item => webpush.sendNotification(item.subscription, message)));
    const expiredIds = (subscriptions || []).filter((_, index) => results[index].status === 'rejected' && [404, 410].includes(results[index].reason?.statusCode)).map(item => item.id);
    if (expiredIds.length) await adminClient.from('push_subscriptions').delete().in('id', expiredIds);

    return new Response(JSON.stringify({ sent: results.filter(result => result.status === 'fulfilled').length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Erro ao enviar notificação' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
