-- Adicionar colunas faltantes à tabela restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT;

-- Adicionar colunas faltantes à tabela addresses
ALTER TABLE addresses
ADD COLUMN IF NOT EXISTS number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT;

-- Adicionar coluna para peso por unidade em produtos e suas variações
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS default_weight_kg numeric;

-- Permissões individuais da equipe, armazenadas por usuário.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS order_status_notifications BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Dinheiro',
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pix_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method_2 TEXT,
ADD COLUMN IF NOT EXISTS payment_amount_1 NUMERIC,
ADD COLUMN IF NOT EXISTS payment_amount_2 NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'delivery';

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS payment_fees JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	endpoint TEXT NOT NULL UNIQUE,
	subscription JSONB NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions
FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update ON public.push_subscriptions
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions
FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS gross_amount NUMERIC NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
ADD COLUMN IF NOT EXISTS fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (fee_amount >= 0);

CREATE SEQUENCE IF NOT EXISTS public.order_invoice_number_seq
START WITH 1000
INCREMENT BY 1
MINVALUE 1000;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT nextval('public.order_invoice_number_seq')::TEXT;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;

CREATE TABLE IF NOT EXISTS public.cash_transactions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	type TEXT NOT NULL CHECK (type IN ('entry', 'expense')),
	category TEXT NOT NULL,
	description TEXT NOT NULL,
	amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
	payment_method TEXT NOT NULL,
	cash_amount NUMERIC NOT NULL DEFAULT 0 CHECK (cash_amount >= 0),
	digital_amount NUMERIC NOT NULL DEFAULT 0 CHECK (digital_amount >= 0),
	reference_type TEXT,
	reference_id UUID,
	occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	created_by_id UUID REFERENCES auth.users(id)
);

DROP INDEX IF EXISTS public.cash_transactions_reference_idx;
CREATE UNIQUE INDEX cash_transactions_reference_idx
ON public.cash_transactions(reference_type, reference_id);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_transactions TO authenticated;

ALTER TABLE public.cash_transactions REPLICA IDENTITY FULL;

-- A RLS da tabela financeira consulta o papel do usuario autenticado.
-- SECURITY DEFINER permite consultar o perfil mesmo quando profiles tambem tem RLS.
CREATE OR REPLACE FUNCTION public.cash_flow_is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE id = auth.uid()
			AND role IN ('admin', 'seller')
	);
$$;

REVOKE ALL ON FUNCTION public.cash_flow_is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cash_flow_is_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.cash_flow_can_write()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE id = auth.uid()
			AND LOWER(TRIM(role)) IN ('admin', 'seller', 'vendedor', 'deliverer', 'entregador')
	);
$$;

REVOKE ALL ON FUNCTION public.cash_flow_can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cash_flow_can_write() TO authenticated;

DROP POLICY IF EXISTS cash_transactions_select ON public.cash_transactions;
CREATE POLICY cash_transactions_select ON public.cash_transactions
FOR SELECT TO authenticated USING (public.cash_flow_is_staff());

DROP POLICY IF EXISTS cash_transactions_write ON public.cash_transactions;
CREATE POLICY cash_transactions_write ON public.cash_transactions
FOR INSERT TO authenticated WITH CHECK (
	public.cash_flow_can_write()
	AND COALESCE(reference_type, '') <> 'order'
);

DROP POLICY IF EXISTS cash_transactions_update ON public.cash_transactions;
CREATE POLICY cash_transactions_update ON public.cash_transactions
FOR UPDATE TO authenticated
USING (public.cash_flow_can_write())
WITH CHECK (public.cash_flow_can_write());

DROP POLICY IF EXISTS cash_transactions_delete ON public.cash_transactions;
CREATE POLICY cash_transactions_delete ON public.cash_transactions
FOR DELETE TO authenticated USING (public.cash_flow_is_staff());

-- Venda de pedido somente pode ser criada pela função abaixo, depois que o
-- pedido já estiver finalizado. Isso impede lançamentos manuais no caixa.
CREATE OR REPLACE FUNCTION public.register_completed_order_sale(
	p_order_id UUID,
	p_restaurant_name TEXT,
	p_invoice_number TEXT,
	p_amount NUMERIC,
	p_payment_method TEXT,
	p_cash_amount NUMERIC,
	p_digital_amount NUMERIC,
	p_gross_amount NUMERIC,
	p_fee_amount NUMERIC,
	p_occurred_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NOT public.cash_flow_can_write() THEN
		RAISE EXCEPTION 'Usuário sem permissão para registrar venda finalizada';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.orders
		WHERE id = p_order_id AND status = 'Finalizado'
	) THEN
		RAISE EXCEPTION 'O pedido precisa estar finalizado antes de entrar no caixa';
	END IF;

	INSERT INTO public.cash_transactions (
		type, category, description, amount, payment_method,
		cash_amount, digital_amount, gross_amount, fee_amount,
		reference_type, reference_id, occurred_at, created_by_id
	) VALUES (
		'entry', 'Venda',
		format('Pedido %s - %s', NULLIF(p_invoice_number, ''), COALESCE(p_restaurant_name, 'Cliente')),
		GREATEST(0, p_amount), COALESCE(p_payment_method, 'Dinheiro'),
		GREATEST(0, p_cash_amount), GREATEST(0, p_digital_amount),
		GREATEST(0, p_gross_amount), GREATEST(0, p_fee_amount),
		'order', p_order_id, COALESCE(p_occurred_at, NOW()), auth.uid()
	)
	ON CONFLICT (reference_type, reference_id) DO UPDATE SET
		amount = EXCLUDED.amount,
		payment_method = EXCLUDED.payment_method,
		cash_amount = EXCLUDED.cash_amount,
		digital_amount = EXCLUDED.digital_amount,
		gross_amount = EXCLUDED.gross_amount,
		fee_amount = EXCLUDED.fee_amount,
		occurred_at = EXCLUDED.occurred_at;
END;
$$;

REVOKE ALL ON FUNCTION public.register_completed_order_sale(UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_completed_order_sale(UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ) TO authenticated;

ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS default_weight_kg numeric;

-- Registrar o momento exato em que uma entrega foi concluída.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_completed_at TIMESTAMPTZ;

-- Vincular cada pedido ao cliente que o criou.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS created_by_id UUID;

-- Cores específicas do card inferior do carrinho.
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS cart_card_bg TEXT,
ADD COLUMN IF NOT EXISTS cart_card_text TEXT,
ADD COLUMN IF NOT EXISTS cart_button_bg TEXT,
ADD COLUMN IF NOT EXISTS cart_button_text TEXT;

-- Atualizar os status permitidos pelos novos passos do pedido.
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status IN (
	'Pedido Emitido',
	'Em Separação',
	'Com Entregador',
	'Saiu para Entrega',
	'Pronto para Retirada',
	'Finalizado'
));

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'restaurants'
AND column_name IN ('number', 'complement');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'addresses'
AND column_name IN ('number', 'complement');

-- Habilitar eventos em tempo real para as tabelas usadas pelo aplicativo.
-- Execute esta parte no SQL Editor do Supabase uma única vez.
DO $$
DECLARE
	target_table TEXT;
BEGIN
	FOREACH target_table IN ARRAY ARRAY[
		'orders', 'products', 'categories', 'promotions', 'purchases',
		'restaurants', 'app_settings', 'profiles', 'addresses', 'lists',
		'list_items', 'variant_types', 'product_variants', 'ficha_tecnica',
		'inventory_write_offs', 'audit_logs', 'cash_transactions'
	] LOOP
		IF NOT EXISTS (
			SELECT 1
			FROM pg_publication_rel pr
			JOIN pg_class c ON c.oid = pr.prrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			JOIN pg_publication p ON p.oid = pr.prpubid
			WHERE p.pubname = 'supabase_realtime'
				AND n.nspname = 'public'
				AND c.relname = target_table
		) THEN
			EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
		END IF;
	END LOOP;
END $$;

-- DELETE precisa carregar o id antigo no evento recebido pelo frontend.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.promotions REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.addresses REPLICA IDENTITY FULL;
ALTER TABLE public.lists REPLICA IDENTITY FULL;
ALTER TABLE public.list_items REPLICA IDENTITY FULL;
ALTER TABLE public.variant_types REPLICA IDENTITY FULL;
ALTER TABLE public.product_variants REPLICA IDENTITY FULL;
ALTER TABLE public.ficha_tecnica REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_write_offs REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;