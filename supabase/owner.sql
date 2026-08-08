-- ============================================================
-- Mestrio — Modelo de dono (Super Admin) x admin (Administrator)
-- Padrão inspirado no WordPress:
--   • DONO (is_owner = true) = Super Admin: gerencia papéis, promove/
--     demove admins e pode transferir a posse. É criado UMA vez, via
--     SQL Editor (bootstrap abaixo).
--   • ADMIN (role = 'ADMIN') = Administrator: modera conteúdo
--     (anúncios, suspensão), mas NÃO pode alterar papéis.
-- Execute no Supabase → SQL Editor (idempotente).
-- ============================================================

-- 0) BOOTSTRAP (executar uma única vez, substituindo SEU_AUTH_UID)
-- UPDATE profiles SET role = 'ADMIN', is_owner = true
-- WHERE id = 'SEU_AUTH_UID';

-- 1) Coluna que identifica o dono do projeto
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- 2) Remove a policy ampla que deixava QUALQUER admin editar perfis
--    (inclusive o próprio role). Ações de gestão passam a ser via RPC
--    SECURITY DEFINER abaixo; cada usuário edita apenas o próprio perfil.
DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON profiles;

-- 3) TRIGGER: rede de segurança contra escalonamento direto via REST.
--    - Alterar role ou is_owner: somente o DONO.
--    - Alterar is_suspended: admin ou dono.
--    - auth.uid() NULL (SQL Editor / service role / rotinas) é permitido
--      (bootstrap e automações confiáveis), mas o navegador autenticado
--      com anon key nunca consegue escalar privilégio.
CREATE OR REPLACE FUNCTION block_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

-- 4) FUNÇÕES RPC (SECURITY DEFINER): o anon key do navegador chama a
--    função, que valida internamente quem é o chamador via auth.uid().
--    Só executa de fato se a permissão for válida.

-- 4.1) Mudar papel CLIENT/PROVIDER — só o dono (não permite ADMIN)
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

-- 4.2) Promover a ADMIN — só o dono
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

-- 4.3) Destituir ADMIN — só o dono; o próprio dono não pode ser destituído
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

-- 4.4) Transferir a posse (como "transferir o site" no WordPress) — só o dono atual
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

-- 4.5) Suspender/reativar usuário — admin ou dono
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

-- 5) PERMISSÕES: somente usuários autenticados podem chamar as funções
REVOKE ALL ON FUNCTION set_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION promote_to_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION demote_from_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION transfer_ownership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_user_suspended(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION demote_from_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_suspended(uuid, boolean) TO authenticated;
