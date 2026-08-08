-- ============================================================
-- Mestrio — Migração: Módulo de Administração / Moderação
-- Execute no Supabase → SQL Editor (é idempotente, pode rodar de novo)
-- Adiciona: status do anúncio, expiração, categorias, configurações
-- e permissões (RLS) para o papel ADMIN (dono do projeto).
-- ============================================================

-- 1) STATUS + EXPIRAÇÃO DOS ANÚNCIOS
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'suspended'));
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS service_ads_status_idx ON service_ads (status);

-- 2) SUSPENSÃO DE USUÁRIOS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- 3) TABELA DE CATEGORIAS (gerenciada pelo admin)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Wrench',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4) TABELA DE CONFIGURAÇÕES (key/value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5) SEED: categorias padrão + configuração padrão
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

-- 6) SEGURANÇA (RLS) — CATEGORIAS E CONFIGURAÇÕES
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

-- 7) ADMIN PODE MODERAR ANÚNCIOS (aprovar, rejeitar, expirar, suspender, deletar)
DROP POLICY IF EXISTS "Admin pode atualizar todos os anúncios" ON service_ads;
CREATE POLICY "Admin pode atualizar todos os anúncios"
  ON service_ads FOR UPDATE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admin pode deletar anúncios" ON service_ads;
CREATE POLICY "Admin pode deletar anúncios"
  ON service_ads FOR DELETE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 8) ADMIN PODE GERENCIAR USUÁRIOS (papel e suspensão)
DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON profiles;
CREATE POLICY "Admin pode atualizar perfis"
  ON profiles FOR UPDATE USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 9) LEITURA DOS ANÚNCIOS: o público vê apenas aprovados e não expirados;
-- o provedor vê os próprios anúncios (mesmo pendentes); o admin vê tudo.
DROP POLICY IF EXISTS "Anúncios são públicos para leitura" ON service_ads;
DROP POLICY IF EXISTS "Anúncios pendentes são visíveis para o admin" ON service_ads;
CREATE POLICY "Anúncios visíveis: aprovados, do provedor ou admin"
  ON service_ads FOR SELECT USING (
    (status = 'approved' AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now())))
    OR auth.uid() = provider_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 10) ADMIN PODE LER TODOS OS AGENDAMENTOS (para métricas / gestão)
DROP POLICY IF EXISTS "Admin pode ver todos os agendamentos" ON appointments;
CREATE POLICY "Admin pode ver todos os agendamentos"
  ON appointments FOR SELECT USING (auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));
