# Plano de Implementação: Correções de Segurança, Consistência e Usabilidade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as correções críticas identificadas na auditoria técnica: segurança de RLS (LGPD) no Supabase, bug de cálculo de avaliações, remoção da barreira de entrada de prestadores (atrito zero na Fase 1) e higienização correta de dados sem corromper CEPs/documentos.

**Architecture:** Correções no banco de dados relacional (`schema.sql`) para endurecimento de políticas RLS e triggers; ajustes de modelo de usuário no `services/store.ts` e `pages/CreateAd.tsx` para garantir onboarding imediato; e desacoplamento do mascarador de telefone em `utils/sanitization.ts`.

**Tech Stack:** PostgreSQL (Supabase RLS & PL/pgSQL), TypeScript, React 19, Express.

**Spec:** [`AUDITORIA_TECNICA.md`](file:///d:/FULLSTARK/mestrio/AUDITORIA_TECNICA.md)

---

## Global Constraints
- Port dev deve permanecer `3000` e host `0.0.0.0` conforme [AGENTS.md](file:///d:/FULLSTARK/mestrio/AGENTS.md).
- Não expor credenciais `SUPABASE_SERVICE_ROLE_KEY` ou `GROQ_API_KEY` ao browser.
- Manter resiliência offline do `store.ts` com fallback para `localStorage`.
- Garantir que `npm run type-check` e `npm run build` passem com 0 erros.

---

## Review Focus
1. `recalculate_ad_rating` deve permitir que reviews de clientes atualizem a nota do anúncio sem disparar erro no trigger `trg_service_ads_moderation`.
2. Documentos KYC em `kyc_documents` não podem ser lidos por usuários comuns autenticados (apenas dono do documento e admin autorizado).
3. Novos prestadores de serviço cadastrados devem nascer com `role = 'PROVIDER'` e poder criar anúncios imediatamente (sem fila de aprovação manual prévia na Fase 1).
4. CEPs (ex: `01310-100`) ou dados numéricos não devem ser substituídos por `[número ocultado]` ao passar por `sanitizeText`.
5. Compilação de produção e tipos TypeScript 100% íntegros.

---

### Task 1: Correção de Segurança & RLS no `schema.sql` (LGPD)

**Files:**
- Modify: `schema.sql:1050-1150`

- [ ] **Passo 1: Corrigir policies de `kyc_documents`**
  Substituir a permissão ampla `auth.role() = 'authenticated'` por verificação estrita:
  - SELECT: `auth.uid() = user_id OR is_admin_allowed('verify_providers')`
  - ALL: `auth.role() = 'authenticated' AND is_admin_allowed('verify_providers')`

- [ ] **Passo 2: Corrigir policies de `user_reports`, `audit_logs` e `system_broadcasts`**
  - `user_reports`: exigir `is_admin_allowed('manage_users')` para `ALL`.
  - `audit_logs`: exigir `is_admin_allowed('view_metrics')` para `SELECT`.
  - `system_broadcasts`: exigir `is_admin_allowed('manage_settings')` para `ALL`.

- [ ] **Passo 3: Validar sintaxe SQL das políticas**

---

### Task 2: Correção do Bug de Ratings e Recálculo no `schema.sql`

**Files:**
- Modify: `schema.sql:1358-1378`
- Modify: `schema.sql:55-75` e `schema.sql:220-245` (remover duplicidades)

- [ ] **Passo 1: Adicionar bypass autorizado no `recalculate_ad_rating`**
  Inserir `PERFORM set_config('app.skip_ad_trigger', 'on', true);` antes do `UPDATE service_ads` e `off` após o update na função redefinida na linha 1358.

- [ ] **Passo 2: Limpar declarações duplicadas de tabelas**
  Remover a primeira criação simplificada de `reviews` (linhas 55-63) e unificar em torno da definição canônica com multi-critérios (linhas 1324-1346).

---

### Task 3: Desbloqueio do Onboarding do Prestador (Fase 1 - Atrito Zero)

**Files:**
- Modify: `services/store.ts:610-632`
- Modify: `pages/CreateAd.tsx:180-230`

- [ ] **Passo 1: Ajustar `store.register` para ativação direta de profissionais**
  Ao se registrar com `role === UserRole.PROVIDER`, atribuir `role: UserRole.PROVIDER` diretamente no perfil inicial, sem forçar `role_request: 'PROVIDER'` ou travar a conta como `CLIENT`.

- [ ] **Passo 2: Permitir criação de anúncio imediata em `CreateAd.tsx`**
  Garantir que prestadores cadastrados acessem diretamente o formulário de anúncio sem a tela de bloqueio "Cadastro em Análise".

---

### Task 4: Refinamento da Higienização (`sanitization.ts`)

**Files:**
- Modify: `utils/sanitization.ts:8-48`

- [ ] **Passo 1: Desacoplar `maskPhoneNumbers` de `sanitizeText`**
  `sanitizeText` deve focar na remoção de tags HTML e caracteres maliciosos de injeção sem mascarar números normais (como CEPs `01310-100` e valores).

- [ ] **Passo 2: Manter `maskPhoneNumbers` como função especializada**
  Preservar a função para uso específico onde o mascaramento de contato em descrições for explicitamente desejado.

---

### Task 5: RLS de Orçamentos Comerciais (`detailed_quotes`)

**Files:**
- Modify: `schema.sql:1240-1285`

- [ ] **Passo 1: Adicionar suporte a `client_id` na tabela `detailed_quotes`**
  Permitir que o orçamento registre o ID do cliente autenticado quando houver.

- [ ] **Passo 2: Atualizar política de leitura do `detailed_quotes`**
  Permitir leitura tanto para o prestador (`auth.uid() = provider_id`) quanto para o cliente associado (`auth.uid() = client_id`) e administradores.

---

### Task 6: Verificação de Tipos e Build de Produção

- [ ] **Passo 1: Executar `npm run type-check`**
  Garantir 0 erros de tipagem TypeScript.

- [ ] **Passo 2: Executar `npm run build`**
  Garantir que o bundle de produção Vite e o binário Node `dist/server.cjs` sejam compilados com sucesso.
