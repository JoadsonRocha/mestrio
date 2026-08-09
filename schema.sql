-- Habilitar a extensão para gerar UUIDs (padrão no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. ENUMS (Tipos customizados)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('CLIENT', 'PROVIDER', 'ADMIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'price_unit') THEN
    CREATE TYPE price_unit AS ENUM ('hour', 'job', 'estimate');
  END IF;
END $$;

-- ==========================================
-- 2. TABELAS
-- ==========================================

-- Tabela de Perfis (Estende a tabela nativa auth.users do Supabase)
-- PRIVACIDADE: NÃO armazenamos email/telefone aqui (PII exposta pelo RLS público).
-- O email vive em auth.users (sessão) e o telefone na tabela privada user_private.
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'CLIENT',
  avatar TEXT,
  location TEXT,
  bio TEXT,
  is_certified BOOLEAN DEFAULT false,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES profiles(id),
  referral_credits DECIMAL(10, 2) DEFAULT 0.00, -- $20 in credits upon signup
  referral_cash_earnings DECIMAL(10, 2) DEFAULT 0.00, -- 15% cash earnings
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

-- Impede que um usuário avalie o mesmo anúncio várias vezes (anti-spam de nota)
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS reviews_author_ad_unique ON reviews (ad_id, author_id);
EXCEPTION WHEN unique_violation THEN
  NULL; -- já existem duplicados no banco atual: remover manualmente antes de aplicar
END $$;

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
CREATE POLICY "Usuários leem seus próprios perfis" ON profiles FOR SELECT USING (auth.uid() = id);
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
CREATE OR REPLACE FUNCTION is_chat_participant(check_session_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE session_id = check_session_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Participante vê sessão" ON chat_sessions
  FOR SELECT USING (is_chat_participant(id));
-- Sessões de chat: criadas apenas para um anúncio real e de OUTRO usuário.
-- (A RPC start_chat é o caminho oficial; bloqueia sessões fantasma.)
CREATE POLICY "Participante cria sessão" ON chat_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_ads sa
      WHERE sa.id = ad_id AND sa.provider_id <> auth.uid()
    )
  );
CREATE POLICY "Participante atualiza sessão" ON chat_sessions
  FOR UPDATE USING (is_chat_participant(id));

-- Políticas para Chat Participants (somente participantes da própria sessão)
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem ler participantes" ON chat_participants;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir participantes" ON chat_participants;
DROP POLICY IF EXISTS "Participante vê participante" ON chat_participants;
DROP POLICY IF EXISTS "Participante entra na sessão" ON chat_participants;
CREATE POLICY "Participante vê participante" ON chat_participants
  FOR SELECT USING (is_chat_participant(session_id));
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
  FOR SELECT USING (is_chat_participant(session_id));
DROP POLICY IF EXISTS "Participante envia mensagem" ON messages;
CREATE POLICY "Participante envia mensagem" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND is_chat_participant(session_id)
  );
CREATE POLICY "Participante marca como lida" ON messages
  FOR UPDATE USING (is_chat_participant(session_id));

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

-- ==========================================
-- 5.1 PRIVACIDADE: dados privados do usuário
-- ==========================================
-- Telefone sai de profiles (PII exposta) e passa a morar aqui, acessível
-- apenas ao próprio usuário (ou admin com 'manage_users').
CREATE TABLE IF NOT EXISTS user_private (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE user_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono e admin leem dados privados" ON user_private
  FOR SELECT USING (auth.uid() = user_id OR is_admin_allowed('manage_users'));
CREATE POLICY "Dono insere seus dados privados" ON user_private
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Dono edita seus dados privados" ON user_private
  FOR UPDATE USING (auth.uid() = user_id);

-- Migração: move telefones existentes e remove as colunas de PII de profiles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    EXECUTE 'INSERT INTO user_private (user_id, phone)
             SELECT id, phone FROM profiles WHERE phone IS NOT NULL
             ON CONFLICT (user_id) DO NOTHING';
  END IF;
END $$;
ALTER TABLE profiles DROP COLUMN IF EXISTS email;
ALTER TABLE profiles DROP COLUMN IF EXISTS phone;

DROP POLICY IF EXISTS "Anúncios são públicos para leitura" ON service_ads;
CREATE POLICY "Anúncios visíveis: aprovados, do provedor ou admin"
  ON service_ads FOR SELECT USING (
    (status = 'approved' AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now())))
    OR auth.uid() = provider_id
    OR is_admin_allowed('moderate_ads')
    OR is_admin_allowed('view_metrics')
  );

DROP POLICY IF EXISTS "Admin pode atualizar todos os anúncios" ON service_ads;
CREATE POLICY "Admin pode atualizar todos os anúncios"
  ON service_ads FOR UPDATE USING (auth.role() = 'authenticated'
    AND is_admin_allowed('moderate_ads'));

DROP POLICY IF EXISTS "Admin pode deletar anúncios" ON service_ads;
CREATE POLICY "Admin pode deletar anúncios"
  ON service_ads FOR DELETE USING (auth.role() = 'authenticated'
    AND is_admin_allowed('moderate_ads'));

DROP POLICY IF EXISTS "Admin pode ver todos os agendamentos" ON appointments;
CREATE POLICY "Admin pode ver todos os agendamentos"
  ON appointments FOR SELECT USING (auth.role() = 'authenticated'
    AND is_admin_allowed('view_metrics'));

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

  IF NEW.is_certified IS DISTINCT FROM OLD.is_certified THEN
    IF auth.uid() IS NOT NULL
       AND NOT COALESCE((SELECT (role = 'ADMIN' OR is_owner)
                         FROM profiles WHERE id = auth.uid()), false) THEN
      RAISE EXCEPTION 'Somente administradores podem conceder o selo de verificação.';
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
  DELETE FROM admin_permissions WHERE admin_id = target_user;
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
  -- O ex-dono vira admin e mantém acesso total: ganha todas as permissões.
  INSERT INTO admin_permissions (admin_id, permission)
  SELECT auth.uid(), p
  FROM unnest(ARRAY[
    'moderate_ads', 'manage_users', 'approve_providers',
    'verify_providers', 'manage_categories', 'manage_settings', 'view_metrics'
  ]) AS p
  ON CONFLICT (admin_id, permission) DO NOTHING;
  -- O novo dono não precisa de permissões na tabela (dono tem tudo).
  DELETE FROM admin_permissions WHERE admin_id = new_owner;
END;
$$;

-- Suspender/reativar usuário — admin com permissão 'manage_users' ou dono
CREATE OR REPLACE FUNCTION set_user_suspended(target_user uuid, suspended boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT is_admin_allowed('manage_users') THEN
    RAISE EXCEPTION 'Sem permissão para suspender usuários.';
  END IF;
  UPDATE profiles SET is_suspended = suspended WHERE id = target_user;
END;
$$;

-- Incrementar visualizações de um anúncio (público: anônimo ou autenticado)
-- Sinaliza app.skip_ad_trigger porque a coluna views é protegida pelo trigger
-- de moderação; o UPDATE aqui é legítimo (vem de RPC SECURITY DEFINER).
CREATE OR REPLACE FUNCTION increment_ad_view(ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.skip_ad_trigger', 'on', true);
  UPDATE service_ads SET views = views + 1 WHERE id = ad_id;
  PERFORM set_config('app.skip_ad_trigger', 'off', true);
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

-- Aprovar a solicitação de profissional — admin com permissão
-- 'approve_providers' ou dono (vira PROVIDER)
CREATE OR REPLACE FUNCTION approve_provider_request(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT is_admin_allowed('approve_providers') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar profissionais.';
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

-- Recusar a solicitação de profissional — admin com permissão
-- 'approve_providers' ou dono
CREATE OR REPLACE FUNCTION reject_provider_request(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT is_admin_allowed('approve_providers') THEN
    RAISE EXCEPTION 'Sem permissão para recusar profissionais.';
  END IF;
  UPDATE profiles SET role_request = NULL WHERE id = target_user;
END;
$$;

-- Conceder/remover o selo de profissional verificado — admin com permissão
-- 'verify_providers' ou dono
CREATE OR REPLACE FUNCTION set_user_certified(target_user uuid, certified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT is_admin_allowed('verify_providers') THEN
    RAISE EXCEPTION 'Sem permissão para conceder o selo de verificação.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user AND role = 'PROVIDER') THEN
    RAISE EXCEPTION 'Só é possível verificar usuários com o papel de profissional.';
  END IF;
  UPDATE profiles SET is_certified = certified WHERE id = target_user;
END;
$$;

-- TRIGGER de moderação de anúncios: impede que um profissional aprove o próprio
-- anúncio ou manipule rating/views/expiração/premium via REST direto.
-- Admins (com a permissão 'moderate_ads'), o SQL Editor/service role
-- (auth.uid() NULL) e RPCs SECURITY DEFINER autorizadas (via app.skip_ad_trigger)
-- continuam autorizados. O profissional pode apenas REENVIAR (status 'pending')
-- ou ENCERRAR (status 'expired') os PRÓPRIOS anúncios.
CREATE OR REPLACE FUNCTION block_ad_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Rotinas confiáveis (RPCs SECURITY DEFINER autorizadas) sinalizam via variável local.
  IF COALESCE(current_setting('app.skip_ad_trigger', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.rating IS DISTINCT FROM OLD.rating OR
    NEW.review_count IS DISTINCT FROM OLD.review_count OR
    NEW.views IS DISTINCT FROM OLD.views OR
    NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
    NEW.is_premium IS DISTINCT FROM OLD.is_premium
  ) THEN
    -- SQL Editor / service role: auth.uid() é NULL → permitido.
    IF auth.uid() IS NOT NULL AND NOT is_admin_allowed('moderate_ads') THEN
      -- Profissional pode reenviar/encerrar SOMENTE os próprios anúncios,
      -- mudando apenas o status (nunca rating/views/expiração/premium).
      IF NOT (
        auth.uid() = OLD.provider_id
        AND NEW.status IN ('pending', 'expired')
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
        AND NEW.rating IS NOT DISTINCT FROM OLD.rating
        AND NEW.review_count IS NOT DISTINCT FROM OLD.review_count
        AND NEW.views IS NOT DISTINCT FROM OLD.views
        AND NEW.rejection_reason IS NOT DISTINCT FROM OLD.rejection_reason
        AND NEW.is_premium IS NOT DISTINCT FROM OLD.is_premium
      ) THEN
        RAISE EXCEPTION 'Somente administradores podem alterar a moderação do anúncio.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_ads_moderation ON service_ads;
CREATE TRIGGER trg_service_ads_moderation
  BEFORE UPDATE ON service_ads
  FOR EACH ROW EXECUTE FUNCTION block_ad_escalation();

-- Recalcular nota e contagem de avaliações de um anúncio (usada após reviews).
CREATE OR REPLACE FUNCTION recalculate_ad_rating(ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
  review_total integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM service_ads WHERE id = ad_id) THEN
    RAISE EXCEPTION 'Anúncio não encontrado.';
  END IF;

  SELECT COALESCE(AVG(rating), 0), COUNT(*)::integer
  INTO avg_rating, review_total
  FROM reviews WHERE ad_id = recalculate_ad_rating.ad_id;

  PERFORM set_config('app.skip_ad_trigger', 'on', true);
  UPDATE service_ads SET rating = avg_rating, review_count = review_total WHERE id = ad_id;
  PERFORM set_config('app.skip_ad_trigger', 'off', true);
END;
$$;

-- Listar usuários com email/telefone — somente admin com 'manage_users' ou dono.
-- (O SELECT público de profiles não expõe mais PII; aqui é canal privado.)
CREATE OR REPLACE FUNCTION get_admin_user_list()
RETURNS TABLE (
  id uuid, name text, email text, role user_role, avatar text,
  location text, phone text, bio text,
  is_suspended boolean, is_owner boolean, is_certified boolean,
  role_request text, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT is_admin_allowed('manage_users') THEN
    RAISE EXCEPTION 'Sem permissão para listar usuários.';
  END IF;
  RETURN QUERY
  SELECT p.id, p.name, u.email::text, p.role, p.avatar, p.location,
         pr.phone, p.bio, p.is_suspended, p.is_owner, p.is_certified,
         p.role_request, p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_private pr ON pr.user_id = p.id
  ORDER BY p.created_at DESC
  LIMIT 300;
END;
$$;

-- Criar/reusar sessão de chat entre o cliente logado e o dono do anúncio.
-- SECURITY DEFINER para conseguir inserir os DOIS participantes (a policy de
-- chat_participants só permite auto-inserção). Valida: autenticado, anúncio
-- existe e não é o próprio anúncio do chamador.
CREATE OR REPLACE FUNCTION start_chat(p_ad_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_id uuid := auth.uid();
  provider uuid;
  existing_session uuid;
  new_session uuid;
BEGIN
  IF my_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT provider_id INTO provider FROM service_ads WHERE id = p_ad_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anúncio não encontrado.'; END IF;
  IF provider = my_id THEN RAISE EXCEPTION 'Você não pode conversar consigo mesmo.'; END IF;

  -- Reusa a sessão existente entre este cliente e o provider para o anúncio.
  SELECT cs.id INTO existing_session
  FROM chat_sessions cs
  WHERE cs.ad_id = p_ad_id
    AND EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.session_id = cs.id AND cp.user_id = my_id
    );
  IF existing_session IS NOT NULL THEN
    RETURN existing_session;
  END IF;

  INSERT INTO chat_sessions (ad_id) VALUES (p_ad_id) RETURNING id INTO new_session;
  INSERT INTO chat_participants (session_id, user_id) VALUES
    (new_session, my_id),
    (new_session, provider);

  RETURN new_session;
END;
$$;

-- PERMISSÕES POR ADMIN (RBAC)
-- Lista canônica de permissões que o dono pode conceder.
CREATE OR REPLACE FUNCTION get_admin_permissions_list()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT ARRAY[
    'moderate_ads', 'manage_users', 'approve_providers',
    'verify_providers', 'manage_categories', 'manage_settings', 'view_metrics'
  ]::text[];
$$;

-- Permissões do usuário logado (dono => todas; admin => as concedidas).
-- Usada pelo frontend para exibir/ocultar abas e ações.
CREATE OR REPLACE FUNCTION get_my_permissions()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RETURN get_admin_permissions_list();
  END IF;
  RETURN ARRAY(
    SELECT permission FROM admin_permissions
    WHERE admin_id = auth.uid() ORDER BY permission
  );
END;
$$;

-- Consultar permissões de outro usuário — só o dono
CREATE OR REPLACE FUNCTION get_admin_permissions(target_user uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente o dono pode consultar permissões de admins.';
  END IF;
  RETURN ARRAY(
    SELECT permission FROM admin_permissions
    WHERE admin_id = target_user ORDER BY permission
  );
END;
$$;

-- Definir as permissões de um admin (substitui o conjunto atual) — só o dono.
-- O alvo precisa ser ADMIN; valores desconhecidos são ignorados.
CREATE OR REPLACE FUNCTION set_admin_permissions(target_user uuid, perms text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p text;
  valid text[] := get_admin_permissions_list();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Somente o dono pode definir permissões de admins.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'O usuário de destino precisa ser admin.';
  END IF;
  DELETE FROM admin_permissions WHERE admin_id = target_user;
  IF perms IS NOT NULL THEN
    FOREACH p IN ARRAY perms LOOP
      IF p = ANY(valid) THEN
        INSERT INTO admin_permissions (admin_id, permission)
        VALUES (target_user, p);
      END IF;
    END LOOP;
  END IF;
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
REVOKE ALL ON FUNCTION get_my_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_admin_permissions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_admin_permissions(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION recalculate_ad_rating(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_admin_user_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION start_chat(uuid) FROM PUBLIC;
-- A contagem de views é pública (visitantes anônimos também contam)
REVOKE ALL ON FUNCTION increment_ad_view(uuid) FROM PUBLIC;

-- is_admin_allowed é usada em policies RLS: anon e authenticated precisam
-- executá-la (o dono do projeto também, via SECURITY DEFINER das RPCs).
REVOKE ALL ON FUNCTION is_admin_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin_allowed(text) TO anon;
GRANT EXECUTE ON FUNCTION is_admin_allowed(text) TO authenticated;

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
GRANT EXECUTE ON FUNCTION get_my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_admin_permissions(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_ad_rating(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_user_list() TO authenticated;
GRANT EXECUTE ON FUNCTION start_chat(uuid) TO authenticated;
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
--   for insert with check (
--     bucket_id = 'ad-images' and auth.role() = 'authenticated'
--     -- Evita SVG (stored XSS): SÓ aceite image/jpeg, image/png, image/webp, image/gif
--     and (metadata->>'contentType' in ('image/jpeg','image/png','image/webp','image/gif'))
--   );
-- create policy "Público lê avatares" on storage.objects
--   for select using (bucket_id = 'avatars');
-- create policy "Autenticado envia avatares" on storage.objects
--   for insert with check (
--     bucket_id = 'avatars' and auth.role() = 'authenticated'
--     and (metadata->>'contentType' in ('image/jpeg','image/png','image/webp','image/gif'))
--   );
