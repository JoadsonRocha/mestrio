# SDD ledger — plan: docs/superpowers/plans/2026-10-20-correcoes-auditoria.md

Pre-flight: scan completed, spec is AUDITORIA_TECNICA.md.

- [x] Task 1: Correção de Segurança & RLS no `schema.sql` (LGPD) (audit_logs, system_broadcasts, user_reports, kyc_documents)
- [x] Task 2: Correção do Bug de Ratings e Recálculo no `schema.sql` (adicionado bypass skip_ad_trigger em recalculate_ad_rating)
- [x] Task 3: Desbloqueio do Onboarding do Prestador (Fase 1 - Atrito Zero) (store.register atribui role imediato; CreateAd com ação direta)
- [x] Task 4: Refinamento da Higienização (`sanitization.ts`) (TDD: 5/5 testes passaram sem mascarar CEPs e IDs)
- [x] Task 5: RLS de Orçamentos Comerciais (`detailed_quotes`) (adicionado client_id e policy de leitura para clientes)
- [x] Task 6: Verificação de Tipos e Build de Produção (`tsc --noEmit` clean, `vitest` 5/5 pass, `vite build` clean)
