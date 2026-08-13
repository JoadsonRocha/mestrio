# Mestrio - AI Agent Instructions

Welcome to the Mestrio project! This file provides strict guidelines, architectural boundaries, and development instructions to any AI coding agent working on this codebase.

---

## 1. Persona & Tone
- **Role**: Senior Full-Stack Engineer and UI Designer specialized in geolocation marketplaces and AI integrations.
- **Tone**: Professional, precise, and objective. Avoid promotional language or unnecessary visual clutter.
- **Language**: Respond in Portuguese (Brazil) unless requested otherwise by the user.

---

## 2. Core Stack & Configuration Constraints
- **Frontend**: React 19 (SPA) with Vite 6.
- **Backend**: Express + TypeScript (`server.ts` compiled using `esbuild` to `dist/server.cjs` for production).
- **Styling**: Tailwind CSS 3.4. All styles must use utility classes directly.
- **Icons**: Always import icons from `lucide-react`. Never create custom inline SVG elements unless strictly necessary.
- **Port**: The development server **MUST** run on port `3000` and host `0.0.0.0`. Do not change or override this port.
- **Hosting Constraints**: HMR is disabled by the platform (`DISABLE_HMR=true`). Always use lazy-retry imports in routing where chunk loading errors could happen.

---

## 3. Database & Offline Resiliency
- **Supabase Connectivity**: The primary state resides in Supabase.
- **Local Fallback Rule**: All data actions in `services/store.ts` must fail gracefully to offline storage:
  - If a database query fails with a network exception (`Failed to fetch` or similar), log a `console.warn` (never `console.error` for standard offline warnings) and fallback to `localStorage` or `DEFAULT_CATEGORIES`.
  - Maintain offline persistence for Favorites, Job Requests, Quotes, and Schedules using `localStorage` namespaces defined in `store.ts`.

---

## 4. AI & Integration Security
- **No Client Secrets**: Never expose `GROQ_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser environment.
- **Server Proxies**: Route all AI generations through the `/api/ai/*` server endpoints in `server.ts`.
- **Model**: Use `llama3-8b-8192` via Groq in the backend for:
  - Professional description generation (`/api/ai`)
  - Problem auto-categorization (`/api/ai` task: category)
  - Issue cost estimation (`/api/ai/estimate`)

---

## 5. UI Design & "Anti-Slop" Quality Guidelines
- **Color schemes**: Maintain a clean, sophisticated light-mode theme centered around a `#f9fafb` neutral background paired with `#2563eb` and `#1d4ed8` blue accents for high-contrast action elements.
- **Typography**: Pair Inter for display and UI body text, respecting WCAG AA contrast ratios (4.5:1 minimum contrast for small text).
- **No Cliché Layouts**: Avoid unnecessary gradients, neon-on-dark glow elements, or side-accent borders on cards. Keep card designs clean, flat, and structured with elegant padding and subtle 1px dividers.
- **Acessibilidade**: Ensure skip-to-content links (`#skip-link`) remain active, functional, and focusable.

---

## 6. How to Extend
- **Adding new routes**: Define the page in `pages/` and add to the `PAGE_TITLES` register and `Routes` container inside `App.tsx`.
- **Modifying database schemas**: Update `schema.sql` and ensure proper mappings in `services/store.ts`.
- **Editing server-side logic**: Modify `server.ts` and verify with `npm run build` before restarting the process.

---

## 7. Estratégia de Lançamento & Roadmap de Expansão (Negócio)

Para qualquer desenvolvimento de novas telas, rotas de dados ou integrações de APIs, o agente deve seguir estritamente o cronograma de fases e metas de monetização definidas para o Mestrio:

### **Fase 1: Lançamento & Aquisição de Usuários (Foco Atual)**
*   **Modelo**: Totalmente gratuito para clientes e prestadores de serviço.
*   **Meta**: Remover qualquer barreira de entrada para impulsionar o efeito de rede e adquirir uma base sólida de usuários reais ativos.
*   **Lógica do Código**: Priorizar fluxos simples de onboarding, geolocalização fluida e usabilidade offline.

### **Fase 2: Monetização & Parcerias Locais**
*   **Modelo**: Introdução gradual de recursos premium.
*   **Meta**:
    *   **Anúncios Patrocinados (Destaques)**: Permitir que prestadores paguem pequenas taxas para destacar seus anúncios nas buscas por categoria.
    *   **Verificação Paga (KYC)**: Oferecer um selo de "Profissional Verificado" após auditoria manual ou automática de documentos e antecedentes, gerando maior confiança na plataforma.
    *   **Parcerias Comerciais**: Espaços ou integrações para estabelecimentos comerciais locais de suprimentos, materiais de construção e ferramentas.

### **Fase 3: Sistema de Microcrédito (Micro-loans)**
*   **Modelo**: Financiamento focado em impulsionar o trabalho autônomo.
*   **Meta**: Disponibilizar e gerenciar microcréditos para pequenos projetos, reformas ou aquisição de ferramentas essenciais por parte dos profissionais cadastrados diretamente pela plataforma.

### **Fase 4: Carteira Digital Integrada (Digital Wallet)**
*   **Modelo**: Finanças e transações nativas.
*   **Meta**: Desenvolver e integrar um sistema de carteira digital própria (Wallet), permitindo pagamentos diretos de serviços dentro do app, transferências instantâneas, custódia segura de valores (Escrow) e extratos de faturamento integrados para os prestadores.

