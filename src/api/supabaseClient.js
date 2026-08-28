import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Cliente Supabase (substitui o @base44/sdk)
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidos no .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// TEMPORÁRIO — só pra diagnóstico via Console do navegador. Remover depois
// de resolvido (deixa o cliente supabase acessível digitando `supabase` no
// F12 → Console, pra rodar comandos de teste manualmente).
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

// -----------------------------------------------------------------------
// CORREÇÃO: manter o Realtime autenticado com o token atual.
// Sem isso, o WebSocket do Realtime autentica uma vez (no load da página)
// e nunca mais é avisado quando o token de sessão é renovado
// (autoRefreshToken troca o token por trás dos panos periodicamente).
// Se as políticas RLS da tabela dependem do usuário autenticado, o
// Realtime passa a usar um token vencido e o Postgres para de entregar
// eventos pro navegador — SEM erro nenhum aparecer no console, o canal
// continua mostrando "SUBSCRIBED" normalmente. Isso explica sintomas como
// "as vezes chega notificação, às vezes não" ou "só atualiza se eu sair e
// voltar na página". supabase.auth.onAuthStateChange dispara toda vez que
// o token muda (login, refresh automático, etc) — repassamos pro Realtime
// sempre que isso acontece.
supabase.auth.onAuthStateChange((_event, session) => {
  supabase.realtime.setAuth(session?.access_token ?? supabaseAnonKey);
});

// ---------------------------------------------------------------------------
// Mapa entidade (Base44) -> tabela (Supabase)
// ---------------------------------------------------------------------------
const TABLES = {
  Product: 'products',
  Order: 'orders',
  Category: 'categories',
  Promotion: 'promotions',
  Purchase: 'purchases',
  Restaurant: 'restaurants',
  FichaTecnica: 'ficha_tecnica',
  InventoryWriteOff: 'inventory_write_offs',
  AuditLog: 'audit_logs',
  AppSettings: 'app_settings',
  User: 'profiles',
  ProductBatch: 'product_batches',
  Favorite: 'favorites',
  Address: 'addresses',
  List: 'lists',
  ListItem: 'list_items',
  VariantType: 'variant_types',
  ProductVariant: 'product_variants',
  CashTransaction: 'cash_transactions',
  PushSubscription: 'push_subscriptions',
};

function parseSort(sort) {
  if (!sort) return { column: 'created_date', ascending: false };
  const desc = sort.startsWith('-');
  return { column: desc ? sort.slice(1) : sort, ascending: !desc };
}

function throwIfError(error) {
  if (error) {
    const err = new Error(error?.message || 'Erro no Supabase');
    err.status = error?.code || error?.status;
    err.details = error?.details;
    err.hint = error?.hint;
    err.data = error;
    throw err;
  }
}

// Cria um objeto com a mesma interface que o app já usa: .list, .filter, .get,
// .create, .update, .delete, .subscribe
function makeEntity(tableName) {
  return {
    async list(sort, limit) {
      const { column, ascending } = parseSort(sort);
      let query = supabase.from(tableName).select('*').order(column, { ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data;
    },

    async filter(match = {}, sort, limit) {
      const { column, ascending } = parseSort(sort);
      let query = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(match)) {
        query = query.eq(key, value);
      }
      query = query.order(column, { ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data;
    },

    async get(id) {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle();
      throwIfError(error);
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase.from(tableName).insert(payload).select();
      throwIfError(error);
      if (Array.isArray(data)) {
        return data.length === 1 ? data[0] : data;
      }
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();
      throwIfError(error);
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      throwIfError(error);
      return true;
    },

    subscribe(callback) {
      let channel;
      let retryTimer;
      let stopped = false;
      let reconnecting = false;
      let retryDelay = 1000;

      const connect = (isReconnect = false) => {
        if (stopped) return;

        // Nome único por assinatura: várias telas podem escutar a mesma
        // tabela ao mesmo tempo sem disputar o mesmo canal.
        const currentChannel = supabase
          .channel(`realtime:${tableName}:${crypto.randomUUID()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tableName },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                callback({ type: 'create', data: payload.new });
              } else if (payload.eventType === 'UPDATE') {
                callback({ type: 'update', data: payload.new, previousData: payload.old });
              } else if (payload.eventType === 'DELETE') {
                callback({ type: 'delete', id: payload.old?.id, data: payload.old });
              }
            }
          )
          .subscribe((status) => {
            // LOG TEMPORÁRIO DE DIAGNÓSTICO — mostra se cada canal
            // realmente conecta ('SUBSCRIBED') ou falha, e por qual tabela.
            // Pode remover depois de descobrirmos a causa do 'products' não
            // chegar em tempo real na tela de Estoque.
            console.log(`📡 Realtime [${tableName}] status:`, status);
            if (reconnecting || stopped) return;
            if (status === 'SUBSCRIBED') {
              channel = currentChannel;
              retryDelay = 1000;
              if (isReconnect) callback({ type: 'refresh' });
              return;
            }

            if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && !stopped && !retryTimer) {
              retryTimer = setTimeout(() => {
                retryTimer = undefined;
                retryDelay = Math.min(retryDelay * 2, 30000);
                reconnecting = true;
                if (channel === currentChannel) channel = undefined;
                Promise.resolve(supabase.removeChannel(currentChannel)).finally(() => {
                  reconnecting = false;
                  connect(true);
                });
              }, retryDelay);
            }
          });

        channel = currentChannel;
      };

      connect();

      return () => {
        stopped = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (channel) supabase.removeChannel(channel);
      };
    },
  };
}

const entities = Object.fromEntries(
  Object.entries(TABLES).map(([entityName, table]) => [entityName, makeEntity(table)])
);

// ---------------------------------------------------------------------------
// Auth (mesma interface que o app já chama: base44.auth.X)
// ---------------------------------------------------------------------------
async function me() {
  const { data: { user }, error } = await supabase.auth.getUser();
  throwIfError(error);
  if (!user) throw new Error('Not authenticated');

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        role: 'user',
      })
      .select()
      .single();
    profile = created;
  }

  return {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    role: profile?.role || 'user',
    permissions: profile?.permissions || {},
    contact_number: profile?.contact_number || '',
    created_date: profile?.created_date || user.created_at,
  };
}

const auth = {
  me,

  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error);
  },

  loginWithProvider(provider, redirectPath = '/') {
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirectPath}` },
    });
  },

  async register({ email, password }) {
    const { error } = await supabase.auth.signUp({ email, password });
    throwIfError(error);
  },

  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup',
    });
    throwIfError(error);
    return { access_token: data?.session?.access_token };
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    throwIfError(error);
  },

  // O Supabase já mantém a sessão sozinho após o login/verifyOtp — não é
  // preciso setar o token manualmente. Mantido só para compatibilidade.
  setToken() {},

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    throwIfError(error);
  },

  // Requer que o template de e-mail "Reset Password" no Supabase aponte para
  // /reset-password?token={{ .TokenHash }}&type=recovery (ver instruções) —
  // mantido por compatibilidade com o fluxo antigo por link
  async resetPassword({ resetToken, newPassword }) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: resetToken,
      type: 'recovery',
    });
    throwIfError(verifyError);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error);
  },

  // Fluxo novo: usado depois que o código de 8 dígitos já foi validado
  // (verifyRecoveryOtp), então a sessão de recuperação já está ativa
  async setNewPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error);
  },

  // Cria um funcionário já confirmado (sem e-mail de verificação) — só admin pode chamar.
  // Usa a Edge Function "admin-create-staff" (Admin API oficial do Supabase).
  async adminCreateStaff({ email, password, fullName, role, contactNumber }) {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('admin-create-staff', {
      body: { action: 'create', email, password, fullName, role, contactNumber },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error) throwIfError(error);
    if (data?.error) throw new Error(data.error);
    return data;
  },

  // Atualiza e-mail e/ou senha de um funcionário já existente — só admin pode chamar
  async adminUpdateStaffCredentials({ userId, newEmail, newPassword }) {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('admin-create-staff', {
      body: { action: 'update', userId, newEmail, newPassword },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error) throwIfError(error);
    if (data?.error) throw new Error(data.error);
  },

  // Fluxo de "esqueci a senha" por código digitado (não por link de e-mail)
  async verifyRecoveryOtp({ email, code }) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    throwIfError(error);
    return data;
  },

  redirectToLogin() {
    window.location.href = '/login';
  },
};

// ---------------------------------------------------------------------------
// Integrations (upload de arquivo -> Supabase Storage, bucket "uploads")
// ---------------------------------------------------------------------------
const integrations = {
  Core: {
    async UploadFile({ file }) {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('uploads').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      throwIfError(error);
      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

// ---------------------------------------------------------------------------
// Stock (lotes com validade — entrada e baixa automática FEFO)
// ---------------------------------------------------------------------------
const stock = {
  // Dá entrada em um novo lote de um produto (usado nas Compras)
  async addBatch({ productId, quantity, expirationDate, purchaseId, variantId }) {
    const normalizedQuantity = Number(quantity || 0);
    if (!productId || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return null;
    }

    const { data: currentProduct, error: currentProductError } = await supabase
      .from('products')
      .select('id, stock_quantity, unit')
      .eq('id', productId)
      .maybeSingle();

    if (currentProductError) {
      throwIfError(currentProductError);
    }

    if (!currentProduct) {
      throw new Error(`Produto ${productId} não encontrado ao adicionar lote.`);
    }

    const { data: batch, error: batchError } = await supabase
      .from('product_batches')
      .insert({
        product_id: productId,
        quantity: normalizedQuantity,
        expiration_date: expirationDate || null,
        purchase_id: purchaseId || null,
        variant_id: variantId || null,
      })
      .select()
      .maybeSingle();

    if (batchError) {
      throwIfError(batchError);
    }

    await stock.refreshProductCost(productId).catch(() => {});
    return batch;
  },

  // Baixa estoque automaticamente pelos lotes que vencem primeiro (FEFO), usando a quantidade exata informada.
  async deductFefo({ productId, quantity }) {
    const normalizedQuantity = Number(quantity || 0);
    if (!productId || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return null;
    }

    // OTIMIZAÇÃO DE VELOCIDADE: essa função roda dentro do checkout do
    // cliente e trava o "Confirmar Pedido" até terminar — cada ida ao banco
    // aqui é tempo de espera real na tela. Reduzido de ~6 idas sequenciais
    // pra rodar em paralelo o que é independente:
    //   1) já buscamos 'unit' junto com 'stock_quantity' (1 select, não 2)
    //   2) baixa dos lotes (FEFO) e baixa do estoque total rodam ao mesmo
    //      tempo (Promise.all), não uma esperando a outra
    //   3) refreshProductCost (custo médio) não bloqueia mais — é só um
    //      dado de exibição, não afeta a exatidão do estoque
    const { data: currentProduct, error: productError } = await supabase
      .from('products')
      .select('id, stock_quantity, unit')
      .eq('id', productId)
      .maybeSingle();
    throwIfError(productError);

    if (!currentProduct) {
      throw new Error(`Produto ${productId} não encontrado ao tentar dar baixa FEFO.`);
    }

    const currentStock = Number(currentProduct.stock_quantity || 0);
    if (normalizedQuantity > currentStock) {
      throw new Error(`Estoque insuficiente para baixa FEFO. Disponível: ${currentStock}, solicitado: ${normalizedQuantity}.`);
    }

    const deductBatches = async () => {
      let updatedBatches = [];
      let batchDeductionSucceeded = false;
      try {
        const { data: batches, error: batchError } = await supabase
          .from('product_batches')
          .select('id, quantity, expiration_date')
          .eq('product_id', productId)
          .gt('quantity', 0);

        if (!batchError && Array.isArray(batches) && batches.length > 0) {
          const sortedBatches = batches.slice().sort((a, b) => {
            const aDate = a?.expiration_date ? new Date(a.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b?.expiration_date ? new Date(b.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
            return aDate - bDate;
          });

          let remaining = normalizedQuantity;
          for (const batch of sortedBatches) {
            if (remaining <= 0) break;
            const batchQuantity = Number(batch.quantity || 0);
            if (batchQuantity <= 0) continue;

            const consume = Math.min(batchQuantity, remaining);
            const { data: updatedBatch, error: updateError } = await supabase
              .rpc('decrement_batch_quantity', { p_batch_id: batch.id, p_amount: consume })
              .maybeSingle();

            if (updateError) {
              throw updateError;
            }

            updatedBatches.push(updatedBatch);
            remaining -= consume;
          }

          batchDeductionSucceeded = updatedBatches.length > 0 && remaining <= 0;
        }
      } catch (batchErr) {
        console.warn('Baixa FEFO por lotes não foi possível; usando fallback de estoque total:', batchErr);
        updatedBatches = [];
        batchDeductionSucceeded = false;
      }
      return { updatedBatches, batchDeductionSucceeded };
    };

    // Apenas executar deductBatches — NÃO chamar adjustProductStock!
    // Quando um lote é atualizado (decrementado), o trigger recompute_product_stock
    // dispara automaticamente e recalcula o total. Se chamarmos adjustProductStock,
    // duplica a baixa!
    const { updatedBatches, batchDeductionSucceeded } = await deductBatches();

    if (!batchDeductionSucceeded) {
      throw new Error(`Falha ao fazer baixa FEFO dos lotes do produto ${productId}.`);
    }

    // Não bloqueia mais o checkout do cliente — roda em segundo plano.
    void stock.refreshProductCost(productId).catch((err) => {
      console.warn('Não foi possível atualizar o custo do produto após baixa FEFO:', err);
    });

    return {
      productId,
      quantity: normalizedQuantity,
      updatedBatches,
      usedFallback: !batchDeductionSucceeded,
    };
  },

  async refreshProductCost(productId) {
    if (!productId) return null;

    const { data: batches, error: batchesError } = await supabase
      .from('product_batches')
      .select('id, product_id, quantity, expiration_date, purchase_id')
      .eq('product_id', productId)
      .gt('quantity', 0)
      .order('expiration_date', { ascending: true, nullsFirst: false });
    throwIfError(batchesError);

    if (!batches || batches.length === 0) {
      const newCost = 0;
      const { data, error } = await supabase
        .from('products')
        .update({ purchase_cost: newCost })
        .eq('id', productId)
        .select()
        .maybeSingle();
      throwIfError(error);
      return data;
    }

    const activeBatch = batches[0];
    if (!activeBatch || !activeBatch.purchase_id) {
      const newCost = 0;
      const { data, error } = await supabase
        .from('products')
        .update({ purchase_cost: newCost })
        .eq('id', productId)
        .select()
        .maybeSingle();
      throwIfError(error);
      return data;
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', activeBatch.purchase_id)
      .maybeSingle();
    throwIfError(purchaseError);
    if (!purchase) {
      const newCost = 0;
      const { data, error } = await supabase
        .from('products')
        .update({ purchase_cost: newCost })
        .eq('id', productId)
        .select()
        .maybeSingle();
      throwIfError(error);
      return data;
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('name')
      .eq('id', productId)
      .maybeSingle();
    throwIfError(productError);
    if (!product) {
      const newCost = 0;
      const { data, error } = await supabase
        .from('products')
        .update({ purchase_cost: newCost })
        .eq('id', productId)
        .select()
        .maybeSingle();
      throwIfError(error);
      return data;
    }

    const batchItem = Array.isArray(purchase.products)
      ? purchase.products.find((item) => item.product_id === productId) || purchase.products.find((item) => item.product_name === product.name)
      : null;

    let newCost = 0;
    if (batchItem) {
      const parsedPrice = parseFloat(batchItem.price);
      if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
        newCost = parsedPrice;
      } else {
        const quantity = parseFloat(batchItem.quantity) || 0;
        const totalCost = parseFloat(batchItem.total_cost) || 0;
        newCost = quantity > 0 ? totalCost / quantity : 0;
      }
    }

    newCost = Number(newCost.toFixed(2));
    const { data, error } = await supabase
      .from('products')
      .update({ purchase_cost: newCost })
      .eq('id', productId)
      .select()
      .maybeSingle();
    throwIfError(error);
    return data;
  },

  async decrementStock({ productId, quantity }) {
    const normalizedQuantity = Number(quantity || 0);
    if (!productId || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return null;
    }
    return stock.adjustProductStock({ productId, delta: -normalizedQuantity });
  },

  // IMPORTANTE: este ajuste é feito via RPC atômica no Postgres (fn adjust_product_stock).
  // NUNCA volte a fazer SELECT stock_quantity -> calcular em JS -> UPDATE aqui.
  // Esse padrão (ler, calcular, escrever) tem race condition: duas chamadas concorrentes
  // leem o mesmo valor antigo e uma sobrescreve a outra, corrompendo o estoque.
  // A função SQL faz `stock_quantity = stock_quantity + delta` dentro do próprio UPDATE,
  // então o Postgres serializa (lock de linha) e cada chamada sempre parte do valor
  // já confirmado pela chamada anterior. Ver: supabase_migration_stock_atomic.sql
  async adjustProductStock({ productId, delta, unit }) {
    const normalizedDelta = Number(delta || 0);
    if (!productId || !Number.isFinite(normalizedDelta) || normalizedDelta === 0) {
      return null;
    }

    console.log(`💾 adjustProductStock CALL | productId: ${productId} | delta: ${normalizedDelta} | unit: ${unit}`);

    try {
      // Só precisamos do 'unit' para decidir se arredondamos o delta (produtos por
      // unidade não podem ter estoque fracionado). Essa leitura NÃO participa da
      // race condition porque não é usada para calcular o novo estoque.
      let productUnit = unit;
      if (!productUnit) {
        const { data: currentProduct, error: fetchError } = await supabase
          .from('products')
          .select('unit')
          .eq('id', productId)
          .maybeSingle();

        if (fetchError) {
          console.warn('Falha ao buscar produto para ajustar estoque:', fetchError);
          return null;
        }
        productUnit = currentProduct?.unit || 'un';
      }

      const isWeightUnit = ['kg', 'g', 'litro', 'l', 'ml'].includes(String(productUnit).trim().toLowerCase());
      const parsedDelta = isWeightUnit ? normalizedDelta : Math.round(normalizedDelta);

      const { data, error } = await supabase
        .rpc('adjust_product_stock', { p_product_id: productId, p_delta: parsedDelta });

      if (error) {
        throw new Error(error.message || 'Falha ao atualizar estoque do produto.');
      }

      return data ?? parsedDelta;
    } catch (err) {
      console.warn('Erro inesperado ao ajustar estoque:', err);
      return null;
    }
  },

  // Lista os lotes de um produto, do que vence primeiro para o que vence por último
  async listBatches(productId) {
    let query = supabase.from('product_batches').select('*').gt('quantity', 0);
    if (productId) query = query.eq('product_id', productId);
    const { data, error } = await query.order('expiration_date', { ascending: true, nullsFirst: false });
    throwIfError(error);
    return data;
  },

  // Lista todos os lotes com o nome/unidade do produto já incluído (para a tela de Vencimentos)
  async listBatchesWithProduct() {
    const { data, error } = await supabase
      .from('product_batches')
      .select('*, product:products(name, unit, category)')
      .gt('quantity', 0)
      .order('expiration_date', { ascending: true, nullsFirst: false });
    throwIfError(error);
    return data;
  },
};

const cash = {
  async syncPurchase({ purchaseId, supplierName, invoiceNumber, date, total, paymentMethod, cashAmount, pixAmount, cardAmount }) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      type: 'expense',
      category: 'Compra de fornecedor',
      description: `Compra ${invoiceNumber || ''} - ${supplierName || 'Fornecedor'}`.trim(),
      amount: Number(total || 0),
      payment_method: paymentMethod,
      cash_amount: Number(cashAmount || 0),
      digital_amount: Number(pixAmount || 0) + Number(cardAmount || 0),
      reference_type: 'purchase',
      reference_id: purchaseId,
      occurred_at: date ? `${date}T12:00:00` : new Date().toISOString(),
      created_by_id: user?.id || null,
    };
    const { error } = await supabase.from('cash_transactions').upsert(payload, { onConflict: 'reference_type,reference_id' });
    throwIfError(error);
  },

  async syncSale({ orderId, restaurantName, invoiceNumber, total, paymentMethod, paymentMethod2, paymentAmount1, paymentAmount2, paymentFees, occurredAt }) {
    const amount = Number(total || 0);
    const firstAmount = paymentMethod2 ? Number(paymentAmount1 || 0) : amount;
    const secondAmount = paymentMethod2 ? Number(paymentAmount2 || 0) : 0;
    const methods = [[paymentMethod || 'Dinheiro', firstAmount], [paymentMethod2, secondAmount]].filter(([, value]) => value > 0);
    if (Math.abs(firstAmount + secondAmount - amount) > 0.01) {
      throw new Error('Os valores das formas de pagamento precisam somar exatamente o total do pedido.');
    }
    const isDigital = (method) => {
      const normalized = String(method || '').trim().toLocaleLowerCase('pt-BR');
      return normalized === 'pix' || normalized.includes('cartão') || normalized.includes('cartao');
    };
    const cashAmount = methods.reduce((sum, [method, value]) => sum + (isDigital(method) ? 0 : value), 0);
    const digitalAmount = methods.reduce((sum, [method, value]) => sum + (isDigital(method) ? value : 0), 0);
    const getFeeRate = (method) => {
      const key = Object.keys(paymentFees || {}).find(item => item.toLocaleLowerCase('pt-BR') === String(method || '').toLocaleLowerCase('pt-BR'));
      return Math.max(0, Number(key ? paymentFees[key] : 0) || 0);
    };
    const feeAmount = methods.reduce((sum, [method, value]) => sum + (value * getFeeRate(method) / 100), 0);
    const digitalFee = methods.reduce((sum, [method, value]) => sum + (isDigital(method) ? value * getFeeRate(method) / 100 : 0), 0);
    const { data: { user } } = await supabase.auth.getUser();
    const paymentLabel = methods.map(([method]) => method).join(' + ');
    const { error } = await supabase.rpc('register_completed_order_sale', {
      p_order_id: orderId,
      p_restaurant_name: restaurantName || 'Cliente',
      p_invoice_number: invoiceNumber || '',
      p_amount: Math.max(0, amount - feeAmount),
      p_payment_method: paymentLabel || 'Dinheiro',
      p_cash_amount: Math.max(0, cashAmount),
      p_digital_amount: Math.max(0, digitalAmount - digitalFee),
      p_gross_amount: amount,
      p_fee_amount: feeAmount,
      p_occurred_at: occurredAt || new Date().toISOString(),
    });
    throwIfError(error);
  },

  async removeReference(referenceType, referenceId) {
    if (!referenceType || !referenceId) return;
    const { error } = await supabase.from('cash_transactions')
      .delete()
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId);
    throwIfError(error);
  },
};

const notifications = {
  async sendDeliveryAssignment({ delivererId, restaurantName, invoiceNumber, total }) {
    const { data, error } = await supabase.functions.invoke('send-delivery-notification', {
      body: { delivererId, restaurantName, invoiceNumber, total },
    });
    if (error) throw error;
    return data;
  },
};

// Mantém o mesmo nome de export (`base44`) usado em todo o app
export const base44 = { entities, auth, integrations, stock, cash, notifications };
