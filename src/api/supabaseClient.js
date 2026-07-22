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
  VariantType: 'variant_types',
  ProductVariant: 'product_variants',
};

function parseSort(sort) {
  if (!sort) return { column: 'created_date', ascending: false };
  const desc = sort.startsWith('-');
  return { column: desc ? sort.slice(1) : sort, ascending: !desc };
}

function throwIfError(error) {
  if (error) {
    const err = new Error(error.message || 'Erro no Supabase');
    err.status = error.code;
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
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      throwIfError(error);
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      throwIfError(error);
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      throwIfError(error);
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      throwIfError(error);
      return true;
    },

    subscribe(callback) {
      // Nome único por assinatura: várias telas podem escutar a mesma
      // tabela ao mesmo tempo sem disputar o mesmo canal.
      const channel = supabase
        .channel(`realtime:${tableName}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              callback({ type: 'create', data: payload.new });
            } else if (payload.eventType === 'UPDATE') {
              callback({ type: 'update', data: payload.new });
            } else if (payload.eventType === 'DELETE') {
              callback({ type: 'delete', id: payload.old?.id, data: payload.old });
            }
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    role: profile?.role || 'user',
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
  // /reset-password?token={{ .TokenHash }}&type=recovery (ver instruções)
  async resetPassword({ resetToken, newPassword }) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: resetToken,
      type: 'recovery',
    });
    throwIfError(verifyError);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error);
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
    const { data, error } = await supabase.rpc('add_stock_batch', {
      p_product_id: productId,
      p_quantity: quantity,
      p_expiration_date: expirationDate || null,
      p_purchase_id: purchaseId || null,
      p_variant_id: variantId || null,
    });
    throwIfError(error);
    return data;
  },

  // Baixa estoque automaticamente pelos lotes que vencem primeiro (FEFO).
  // Retorna a quantidade que realmente foi baixada.
  async deductFefo({ productId, quantity }) {
    const { data, error } = await supabase.rpc('deduct_stock_fefo', {
      p_product_id: productId,
      p_quantity: quantity,
    });
    throwIfError(error);
    return data;
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

// Mantém o mesmo nome de export (`base44`) usado em todo o app
export const base44 = { entities, auth, integrations, stock };
