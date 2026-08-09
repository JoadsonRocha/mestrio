-- Habilitar a extensão para gerar UUIDs (padrão no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. ENUMS (Tipos customizados)
-- ==========================================
CREATE TYPE user_role AS ENUM ('CLIENT', 'PROVIDER', 'ADMIN');
CREATE TYPE price_unit AS ENUM ('hour', 'job', 'estimate');

-- ==========================================
-- 2. TABELAS
-- ==========================================

-- Tabela de Perfis (Estende a tabela nativa auth.users do Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'CLIENT',
  avatar TEXT,
  location TEXT,
  phone TEXT,
  bio TEXT,
  is_certified BOOLEAN DEFAULT false,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Anúncios de Serviços (Mestrio)
CREATE TABLE service_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  price_unit price_unit NOT NULL DEFAULT 'job',
  location TEXT NOT NULL,
  images TEXT[] DEFAULT '{}', -- Array de URLs de imagens
  rating DECIMAL(3, 2) DEFAULT 0.00,
  review_count INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  whatsapp TEXT NOT NULL,
  availability TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Avaliações (Reviews)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES service_ads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Para bancos onde a tabela reviews já existia antes da coluna do nome
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_name TEXT;

-- Tabela de Sessões de Chat (Negociações)
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES service_ads(id) ON DELETE CASCADE,
  last_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Participantes do Chat (Relacionamento N:M)
CREATE TABLE chat_participants (
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, user_id)
);

-- Tabela de Mensagens do Chat
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- 3. SEGURANÇA (Row Level Security - RLS)
-- ==========================================
-- O Supabase exige que habilitemos o RLS para segurança

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
CREATE POLICY "Perfis são públicos para leitura" ON profiles FOR SELECT USING (true);
CREATE POLICY "Usuários inserem seu próprio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuários atualizam seu próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas para Service Ads (Anúncios)
CREATE POLICY "Anúncios são públicos para leitura" ON service_ads FOR SELECT USING (true);
CREATE POLICY "Profissionais criam seus próprios anúncios" ON service_ads FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Profissionais atualizam seus próprios anúncios" ON service_ads FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "Profissionais deletam seus próprios anúncios" ON service_ads FOR DELETE USING (auth.uid() = provider_id);

-- Políticas para Reviews
CREATE POLICY "Reviews são públicos para leitura" ON reviews FOR SELECT USING (true);
CREATE POLICY "Usuários autenticados podem criar reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Políticas para Chat Sessions (somente participantes)
DROP POLICY IF EXISTS "Usuários autenticados podem ler sessões" ON chat_sessions;
DROP POLICY IF EXISTS "Usuários autenticados podem criar sessões" ON chat_sessions;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar sessões" ON chat_sessions;
DROP POLICY IF EXISTS "Participante vê sessão" ON chat_sessions;
DROP POLICY IF EXISTS "Participante cria sessão" ON chat_sessions;
CREATE POLICY "Participante vê sessão" ON chat_sessions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM chat_participants WHERE session_id = id)
  );
CREATE POLICY "Participante cria sessão" ON chat_sessions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Participante atualiza sessão" ON chat_sessions
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM chat_participants WHERE session_id = id)
  );

-- Políticas para Chat Participants (somente participantes da própria sessão)
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem ler participantes" ON chat_participants;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir participantes" ON chat_participants;
DROP POLICY IF EXISTS "Participante vê participante" ON chat_participants;
DROP POLICY IF EXISTS "Participante entra na sessão" ON chat_participants;
CREATE POLICY "Participante vê participante" ON chat_participants
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM chat_participants WHERE session_id = session_id)
  );
CREATE POLICY "Participante entra na sessão" ON chat_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para Messages (somente participantes)
DROP POLICY IF EXISTS "Usuários autenticados podem ler mensagens" ON messages;
DROP POLICY IF EXISTS "Usuários enviam mensagens com seu próprio ID" ON messages;
DROP POLICY IF EXISTS "Usuários podem marcar mensagens como lidas" ON messages;
DROP POLICY IF EXISTS "Participante lê mensagens" ON messages;
DROP POLICY IF EXISTS "Participante envia mensagem" ON messages;
DROP POLICY IF EXISTS "Participante marca como lida" ON messages;
CREATE POLICY "Participante lê mensagens" ON messages
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM chat_participants WHERE session_id = session_id)
  );
CREATE POLICY "Participante envia mensagem" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Participante marca como lida" ON messages
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM chat_participants WHERE session_id = session_id)
  );

-- Tabela de Agendamentos (Appointments)
-- IF NOT EXISTS permite rodar o script novamente sem erro
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES service_ads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  notes TEXT,
  client_location TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Para bancos onde a tabela já existia antes da coluna de localização
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_location TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver seus agendamentos" ON appointments;
CREATE POLICY "Usuários autenticados podem ver seus agendamentos" ON appointments 
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = provider_id);

DROP POLICY IF EXISTS "Clientes podem criar agendamentos" ON appointments;
CREATE POLICY "Clientes podem criar agendamentos" ON appointments 
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Participantes podem atualizar agendamentos" ON appointments;
CREATE POLICY "Participantes podem atualizar agendamentos" ON appointments 
  FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = provider_id);

-- ==========================================
-- 4. REALTIME (mensagens em tempo real no chat)
-- ==========================================
-- Habilita a publicação de mensagens e sessões de chat para o Realtime do Supabase.
-- Se você já tinha estas tabelas criadas, basta rodar os dois comandos abaixo:
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- 5. MÓDULO DE ADMINISTRAÇÃO / MODERAÇÃO
-- ==========================================
-- Idempotente (pode rodar de novo). Adiciona: status do anúncio,
-- expiração, categorias, configurações e permissões (RLS) para o ADMIN.

ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'suspended'));
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_certified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_request TEXT;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Wrench',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO categories (slug, name, icon, sort_order, active) VALUES
  ('electrician', 'Eletricista', 'Zap', 1, true),
  ('plumber', 'Encanador', 'Droplets', 2, true),
  ('painter', 'Pintor', 'Paintbrush', 3, true),
  ('cleaning', 'Faxina', 'Brush', 4, true),
  ('handyman', 'Marido de Aluguel', 'Wrench', 5, true),
  ('moving', 'Mudanças', 'Truck', 6, true),
  ('gardener', 'Jardineiro', 'Leaf', 7, true),
  ('assembly', 'Montagem de Móveis', 'Package', 8, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES ('ad_duration_days', '30')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- PERMISSÕES POR ADMIN (RBAC): o DONO concede funções a cada admin.
CREATE TABLE IF NOT EXISTS admin_permissions (
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (admin_id, permission)
);
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
-- Cada admin vê apenas as próprias permissões; criar/alterar é via RPC do dono.
CREATE POLICY "Admin vê suas próprias permissões"
  ON admin_permissions FOR SELECT USING (auth.uid() = admin_id);

-- Helper usado em policies e RPCs: dono tem todas as funções; o admin só as
-- que o dono concedeu na tabela admin_permissions.
CREATE OR REPLACE FUNCTION is_admin_allowed(required_perm text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.is_owner THEN true
      ELSE EXISTS (
        SELECT 1 FROM admin_permissions ap
        WHERE ap.admin_id = p.id AND ap.permission = required_perm
      )
    END
    FROM profiles p
    WHERE p.id = auth.uid()
  ), false);
$$;

CREATE POLICY "Categorias são públicas para leitura"
  ON categories FOR SELECT USING (true);
CREATE POLICY "Somente admin insere categorias"
  ON categories FOR INSERT WITH CHECK (auth.role() = 'authenticated'
    AND is_admin_allowed('manage_categories'));
CREATE POLICY "Somente admin atualiza categorias"
  ON categories FOR UPDATE USING (auth.role() = 'authenticated'
    AND is_admin_allowed('manage_categories'));
CREATE POLICY "Somente admin deleta categorias"
  ON categories FOR DELETE USING (auth.role() = 'authenticated'
    AND is_admin_allowed('manage_categories'));

CREATE POLICY "Configurações são públicas para leitura"
  ON app_settings FOR SELECT USING (true);
CREATE POLICY "Somente admin altera configurações"
  ON app_settings FOR ALL USING (auth.role() = 'authenticated'
    AND is_admin_allowed('manage_settings'))
  WITH CHECK (auth.role() = 'authenticated'
    AND is_admin_allowed('manage_settings'));

DROP POLICY IF EXISTS "Anúncios são públicos para leitura" ON service_ads;
CREATE POLICY "Anúncios visíveis: aprovados, do provedor ou admin"
  ON service_ads FOR SELECT USING (
    (status = 'approved' AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now())))
    OR auth.uid() = provider_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

DROP POLICY IF EXISTS "Admin pode atualizar todos os anúncios" ON service_ads;
CREATE POLICY "Admin pode atualizar todos os anúncios"
  ON service_ads FOR UPDATE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admin pode deletar anúncios" ON service_ads;
CREATE POLICY "Admin pode deletar anúncios"
  ON service_ads FOR DELETE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admin pode ver todos os agendamentos" ON appointments;
CREATE POLICY "Admin pode ver todos os agendamentos"
  ON appointments FOR SELECT USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- NOTA: NÃO criamos mais a policy ampla "Admin pode atualizar perfis".
-- A gestão de papéis/suspensão agora é feita exclusivamente pelas funções
-- RPC SECURITY DEFINER na seção 6 (modelo dono/admin); cada usuário edita
-- apenas o próprio perfil.

-- ==========================================
-- 6. MODELO DONO (SUPER ADMIN) x ADMIN
-- ==========================================
-- Padrão inspirado no WordPress:
--   • DONO (is_owner = true) = Super Admin: gerencia papéis, promove/
--     demove admins e transfere a posse. Definido UMA vez (bootstrap).
--   • ADMIN (role = 'ADMIN') = Administrator: modera conteúdo
--     (anúncios, suspensão), mas NÃO pode alterar papéis.

-- BOOTSTRAP (após criar um usuário, executar UMA vez via SQL Editor,
-- substituindo SEU_AUTH_UID):
-- UPDATE profiles SET role = 'ADMIN', is_owner = true
-- WHERE id = 'SEU_AUTH_UID';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- TRIGGER: rede de segurança contra escalonamento direto via REST.
-- - Alterar role ou is_owner: somente o DONO.
-- - Alterar is_suspended: admin ou dono.
-- - auth.uid() NULL (SQL Editor / service role / rotinas) é permitido
--   (bootstrap e automações confiáveis), mas o navegador autenticado
--   com anon key nunca consegue escalar privilégio.
CREATE OR REPLACE FUNCTION block_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Rotinas confiáveis (RPCs SECURITY DEFINER autorizadas) podem sinalizar
  -- que a alteração de papel é legítima, via variável de sessão local.
  IF COALESCE(current_setting('app.skip_privilege_trigger', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_owner IS DISTINCT FROM OLD.is_owner) THEN
    IF auth.uid() IS NOT NULL
       AND NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
      RAISE EXCEPTION 'Somente o dono do projeto pode alterar papéis.';
    END IF;
  END IF;

  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
    IF auth.uid() IS NOT NULL
       AND NOT COALESCE((SELECT (role = 'ADMIN' OR is_owner)
                         FROM profiles WHERE id = auth.uid()), false) THEN
      RAISE EXCEPTION 'Somente administradores podem suspender usuários.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_privilege ON profiles;
CREATE TRIGGER trg_profiles_privilege
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION block_privilege_escalation();

-- FUNÇÕES RPC (SECURITY DEFINER): o anon key do navegador chama a função,
-- que valida internamente quem é o chamador via auth.uid(). Só executa de
-- fato se a permissão for válida.

-- Mudar papel CLIENT/PROVIDER — só o dono (não permite ADMIN)
CREATE OR REPLACE FUNCTION set_user_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente o dono do projeto pode alterar papéis.';
  END IF;
  IF new_role NOT IN ('CLIENT', 'PROVIDER') THEN
    RAISE EXCEPTION 'Papel inválido. Use CLIENT ou PROVIDER.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
  UPDATE profiles SET role = new_role WHERE id = target_user;
END;
$$;

-- Promover a ADMIN — só o dono
CREATE OR REPLACE FUNCTION promote_to_admin(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente o dono do projeto pode promover administradores.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
  UPDATE profiles SET role = 'ADMIN' WHERE id = target_user;
END;
$$;

-- Destituir ADMIN — só o dono; o próprio dono não pode ser destituído
CREATE OR REPLACE FUNCTION demote_from_admin(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente o dono do projeto pode destituir administradores.';
  END IF;
  IF COALESCE((SELECT is_owner FROM profiles WHERE id = target_user), false) THEN
    RAISE EXCEPTION 'O dono do projeto não pode ser destituído.';
  END IF;
  UPDATE profiles SET role = 'PROVIDER' WHERE id = target_user AND role = 'ADMIN';
END;
$$;

-- Transferir a posse (como "transferir o site" no WordPress) — só o dono atual
CREATE OR REPLACE FUNCTION transfer_ownership(new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente o dono pode transferir a posse.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = new_owner) THEN
    RAISE EXCEPTION 'Novo dono inválido.';
  END IF;
  UPDATE profiles SET is_owner = false WHERE id = auth.uid();
  UPDATE profiles SET is_owner = true, role = 'ADMIN' WHERE id = new_owner;
END;
$$;

-- Suspender/reativar usuário — admin ou dono
CREATE OR REPLACE FUNCTION set_user_suspended(target_user uuid, suspended boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT (role = 'ADMIN' OR is_owner)
                   FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente administradores podem suspender usuários.';
  END IF;
  UPDATE profiles SET is_suspended = suspended WHERE id = target_user;
END;
$$;

-- Incrementar visualizações de um anúncio (público: anônimo ou autenticado)
CREATE OR REPLACE FUNCTION increment_ad_view(ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE service_ads SET views = views + 1 WHERE id = ad_id;
END;
$$;

-- Solicitar mudança para profissional (o próprio usuário) — apenas CLIENT
CREATE OR REPLACE FUNCTION request_provider_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  UPDATE profiles SET role_request = 'PROVIDER'
  WHERE id = auth.uid() AND role = 'CLIENT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apenas clientes podem solicitar o papel de profissional.';
  END IF;
END;
$$;

-- Cancelar a solicitação de profissional (o próprio usuário)
CREATE OR REPLACE FUNCTION cancel_provider_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  UPDATE profiles SET role_request = NULL WHERE id = auth.uid();
END;
$$;

-- Aprovar a solicitação de profissional — admin ou dono (vira PROVIDER)
CREATE OR REPLACE FUNCTION approve_provider_request(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT (role = 'ADMIN' OR is_owner)
                   FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar solicitações de profissional.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user AND role_request = 'PROVIDER') THEN
    RAISE EXCEPTION 'Usuário não encontrado ou sem solicitação pendente.';
  END IF;
  -- Sinaliza ao trigger que esta mudança de papel é legítima (variável de sessão local).
  PERFORM set_config('app.skip_privilege_trigger', 'on', true);
  UPDATE profiles SET role = 'PROVIDER', role_request = NULL WHERE id = target_user;
  PERFORM set_config('app.skip_privilege_trigger', 'off', true);
END;
$$;

-- Recusar a solicitação de profissional — admin ou dono
CREATE OR REPLACE FUNCTION reject_provider_request(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT (role = 'ADMIN' OR is_owner)
                   FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente administradores podem recusar solicitações de profissional.';
  END IF;
  UPDATE profiles SET role_request = NULL WHERE id = target_user;
END;
$$;

-- Conceder/remover o selo de profissional verificado — admin ou dono
CREATE OR REPLACE FUNCTION set_user_certified(target_user uuid, certified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT (role = 'ADMIN' OR is_owner)
                   FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente administradores podem conceder o selo de verificação.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user AND role = 'PROVIDER') THEN
    RAISE EXCEPTION 'Só é possível verificar usuários com o papel de profissional.';
  END IF;
  UPDATE profiles SET is_certified = certified WHERE id = target_user;
END;
$$;

-- PERMISSÕES: somente usuários autenticados podem chamar as funções
REVOKE ALL ON FUNCTION set_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION promote_to_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION demote_from_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION transfer_ownership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_user_suspended(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_provider_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_provider_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_provider_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_provider_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_user_certified(uuid, boolean) FROM PUBLIC;
-- A contagem de views é pública (visitantes anônimos também contam)
REVOKE ALL ON FUNCTION increment_ad_view(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION demote_from_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_suspended(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION request_provider_role() TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_provider_request() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_provider_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_provider_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_certified(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ad_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ad_view(uuid) TO anon;

-- ==========================================
-- 7. STORAGE (imagens de anúncios e avatares)
-- ==========================================
-- Opcional: crie os buckets 'ad-images' e 'avatars' no dashboard
-- (Storage → New bucket → name: ad-images / avatars, Public bucket: sim),
-- e então rode:
-- create policy "Público lê imagens de anúncios" on storage.objects
--   for select using (bucket_id = 'ad-images');
-- create policy "Autenticado envia imagens de anúncios" on storage.objects
--   for insert with check (bucket_id = 'ad-images' and auth.role() = 'authenticated');
-- create policy "Público lê avatares" on storage.objects
--   for select using (bucket_id = 'avatars');
-- create policy "Autenticado envia avatares" on storage.objects
--   for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
