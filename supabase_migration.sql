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
		'inventory_write_offs', 'audit_logs'
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