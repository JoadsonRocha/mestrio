-- =========================================================================
-- 🛡️ MESTRIO - SCRIPT DE PATCH DE SEGURANÇA E CONFORMIDADE LGPD (SUPABASE)
-- Execute este script diretamente no SQL Editor do seu projeto Supabase.
-- =========================================================================

-- 1. CORREÇÃO CRÍTICA: DOCUMENTOS KYC (Elimina vazamento de CPF, RG, CNH e Selfies)
ALTER TABLE IF EXISTS kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário lê seus documentos KYC" ON kyc_documents;
DROP POLICY IF EXISTS "Usuário lê seus próprios documentos ou admin autorizado" ON kyc_documents;
CREATE POLICY "Usuário lê seus próprios documentos ou admin autorizado" ON kyc_documents
  FOR SELECT USING (
    auth.uid() = user_id 
    OR is_admin_allowed('verify_providers')
  );

DROP POLICY IF EXISTS "Admin valida documentos KYC" ON kyc_documents;
DROP POLICY IF EXISTS "Admin gerencia documentos KYC" ON kyc_documents;
CREATE POLICY "Admin gerencia documentos KYC" ON kyc_documents
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('verify_providers')
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('verify_providers')
  );


-- 2. CORREÇÃO DE PRIVACIDADE: PEDIDOS DE SERVIÇO (Protege telefones contra Web Scraping)
ALTER TABLE IF EXISTS job_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um visualiza pedidos de serviços abertos" ON job_requests;
DROP POLICY IF EXISTS "Usuários autenticados visualizam pedidos de serviços abertos" ON job_requests;
CREATE POLICY "Usuários autenticados visualizam pedidos de serviços abertos" ON job_requests
  FOR SELECT USING (auth.role() = 'authenticated');


-- 3. CORREÇÃO DE GOVERNANÇA: LOGS DE AUDITORIA (Restringe acesso a admins com permissão)
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê logs de auditoria" ON audit_logs;
CREATE POLICY "Admin lê logs de auditoria" ON audit_logs
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('view_metrics')
  );


-- 4. CORREÇÃO DE TRUST & SAFETY: DENÚNCIAS E DISPUTAS (Restringe a admins)
ALTER TABLE IF EXISTS user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia denúncias" ON user_reports;
CREATE POLICY "Admin gerencia denúncias" ON user_reports
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('manage_users')
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('manage_users')
  );


-- 5. CORREÇÃO DE COMUNICADOS: SYSTEM BROADCASTS (Criação restrita a admins)
ALTER TABLE IF EXISTS system_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia comunicados" ON system_broadcasts;
CREATE POLICY "Admin gerencia comunicados" ON system_broadcasts
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('manage_settings')
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND is_admin_allowed('manage_settings')
  );

-- Notificação de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Patch de segurança do Mestrio aplicado com sucesso!';
END $$;
