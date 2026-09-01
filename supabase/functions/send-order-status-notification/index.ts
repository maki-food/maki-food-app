import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGE_MAP = {
  'Em Separação': 'Seu pedido está em separação.',
  'Saiu para Entrega': 'Seu pedido saiu para entrega.',
  'Finalizado': 'Seu pedido foi entregue com sucesso.',
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

    const payload = await request.json();
    const { userId, orderId, status, deliverySequence, restaurantName } = payload || {};

    if (!userId || !status) throw new Error('Dados da notificação incompletos');

    // Não checamos mais profiles.order_status_notifications aqui. Essa flag
    // é única por CLIENTE, não por aparelho — usá-la como filtro fazia
    // desativar no computador cortar também o celular (e vice-versa).
    // A fonte da verdade agora é push_subscriptions: cada endpoint (cada
    // navegador/aparelho) só existe ali se aquele aparelho específico está
    // inscrito. Sem inscrição = sem envio, naturalmente, sem precisar de
    // uma flag global.
    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', userId);

    if (subscriptionError) throw subscriptionError;

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    );

    const baseBody = MESSAGE_MAP[status] || 'Atualização do seu pedido.';
    const body = status === 'Saiu para Entrega' && deliverySequence != null
      ? `${baseBody} Sua posição: ${deliverySequence}.`
      : baseBody;

    const message = JSON.stringify({
      title: 'Maki Food',
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      url: '/loja/pedidos',
      tag: `order-status-${orderId || userId}-${status}`,
    });

    const results = await Promise.allSettled(
      (subscriptions || []).map(item => webpush.sendNotification(item.subscription, message))
    );

    const expiredIds = (subscriptions || []).filter((_, index) => {
      const result = results[index];
      return result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode);
    }).map(item => item.id);

    if (expiredIds.length) {
      await adminClient.from('push_subscriptions').delete().in('id', expiredIds);
    }

    return new Response(JSON.stringify({
      sent: results.filter(result => result.status === 'fulfilled').length,
      status,
      userId,
      orderId,
      restaurantName,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Erro ao enviar notificação' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
