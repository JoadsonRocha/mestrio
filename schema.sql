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

-- Políticas para Chat Sessions
CREATE POLICY "Usuários autenticados podem ler sessões" ON chat_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários autenticados podem criar sessões" ON chat_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários autenticados podem atualizar sessões" ON chat_sessions FOR UPDATE USING (auth.role() = 'authenticated');

-- Políticas para Chat Participants
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados podem ler participantes" ON chat_participants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários autenticados podem inserir participantes" ON chat_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas para Messages
CREATE POLICY "Usuários autenticados podem ler mensagens" ON messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários enviam mensagens com seu próprio ID" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Usuários podem marcar mensagens como lidas" ON messages FOR UPDATE USING (auth.role() = 'authenticated');

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
-- Para bancos já existentes, execute o arquivo `supabase/admin.sql`
-- (idempotente). O bloco abaixo cobre instalações novas.

ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'suspended'));
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

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

CREATE POLICY "Categorias são públicas para leitura"
  ON categories FOR SELECT USING (true);
CREATE POLICY "Somente admin insere categorias"
  ON categories FOR INSERT WITH CHECK (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY "Somente admin atualiza categorias"
  ON categories FOR UPDATE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY "Somente admin deleta categorias"
  ON categories FOR DELETE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Configurações são públicas para leitura"
  ON app_settings FOR SELECT USING (true);
CREATE POLICY "Somente admin altera configurações"
  ON app_settings FOR ALL USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

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

DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON profiles;
CREATE POLICY "Admin pode atualizar perfis"
  ON profiles FOR UPDATE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));
