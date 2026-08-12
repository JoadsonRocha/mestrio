# 🛠️ Mestrio — Marketplace de Serviços Gerais & Dashboard Power BI

**Mestrio** é uma plataforma marketplace geolocalizada e moderna que conecta clientes a prestadores de serviços autônomos (eletricistas, encanadores, pintores, faxineiros, maridos de aluguel, entre outros).

A aplicação conta com integração de **Inteligência Artificial (Groq API)** para geração automática de descrições e orçamentos, e um **Dashboard de Business Intelligence (Power BI)** executivo para moderação, auditoria e métricas em tempo real.

📌 **[Consulte o Documento Estratégico & Plano de Negócios de 3 Fases (PLANO_DE_NEGOCIOS.md)](file:///d:/FULLSTARK/mentrio/PLANO_DE_NEGOCIOS.md)**

---

## 🚀 Tecnologias Utilizadas

### **Frontend & Interface**
- **React 19** com **TypeScript**
- **Vite 6** (bundler de alta performance)
- **React Router DOM v7** (navegação SPA)
- **Tailwind CSS 3** (estilização responsiva e temas Claro/Escuro)
- **Lucide React** (iconografia moderna)
- **Leaflet & React-Leaflet** (mapas e busca geolocalizada)

### **Backend & Servidor Express**
- **Node.js** com **Express.js** (proxy seguro de API no Railway)
- **Rate Limiting** (proteção contra abuso de requisições)
- **CSP (Content Security Policy)** e headers de segurança HTTP
- **CORS** restrito a domínios autorizados

### **Banco de Dados & Autenticação (Supabase)**
- **PostgreSQL** com extensão `uuid-ossp`
- **Row Level Security (RLS)** para proteção de dados no nível de linha
- **RPCs PL/pgSQL com SECURITY DEFINER** para gestão de privilégios (Dono x Admin)
- **Supabase Realtime** para mensageria instantânea no chat
- **Privacidade PII**: isolamento de dados sensíveis dos usuários na tabela `user_private`

### **Inteligência Artificial (Groq API)**
- Modelo **`llama3-8b-8192`** da Groq
- **Gerador de Descrições de Serviços**: Cria textos profissionais e atraentes com base no título e categoria
- **Sugestor de Categorias**: Identifica automaticamente a categoria ideal a partir do título
- **Orçador Inteligente (SmartEstimator)**: Assistente virtual no rodapé que estima valores e soluções para problemas descritos pelo cliente

### **Dashboard Executivo Power BI Analytics**
- **Executive Top Bar**: Indicadores de status ao vivo, botões de atualização em tempo real e exportação CSV.
- **Painel de Slicers / Filtros**: Fatiadores por período (7d, 30d, 90d, Histórico) e busca global.
- **Cartões de KPI (Metric Tiles)**: Indicadores visuais gigantes com sparklines (gráficos SVG de tendência) e percentuais de variação.
- **Gráficos Dinâmicos em SVG**:
  - **Rosca de Status**: Moderação de anúncios (Aprovados, Pendentes, Rejeitados, Suspensos, Expirados).
  - **Área & Linha de Crescimento**: Evolução diária da base de usuários.
  - **Barras Horizontais**: Ranking de anúncios por Categoria.
  - **Matriz Top Avaliados**: Ranking dos melhores serviços oferecidos.
- **Módulos de Gestão**: Moderação de anúncios, Usuários & Controle RBAC, Categorias, Logs de Auditoria e Central de Comunicados Globais.

---

## 📁 Estrutura de Pastas do Projeto

```text
mentrio/
├── admin/                     # Módulo Administrativo & Power BI
│   └── pages/
│       └── OwnerDashboard.tsx # Painel Executivo estilo Power BI
├── components/                # Componentes reutilizáveis de UI
│   ├── CategoryIcon.tsx       # Ícones de categoria
│   ├── ErrorBoundary.tsx      # Captura de erros da árvore de componentes
│   ├── FavoritesTab.tsx       # Aba de anúncios favoritados do usuário
│   ├── JobRequestsTab.tsx     # Mural de solicitações de orçamentos
│   ├── Layout.tsx             # Navbar e Footer principais
│   ├── MapView.tsx            # Componente de mapas Leaflet
│   ├── SmartEstimator.tsx     # Assistente de Orçamento Inteligente (IA Groq)
│   └── UI.tsx                 # Componentes básicos de UI (RatingStars, Badge)
├── context/                   # React Contexts
│   ├── AuthContext.tsx        # Gerenciamento de sessão de usuário
│   └── ToastContext.tsx       # Notificações estilo toast na tela
├── pages/                     # Páginas públicas e de usuário
│   ├── Ads.tsx                # Anúncios do usuário
│   ├── Appointments.tsx       # Agendamentos e solicitações
│   ├── CategoryPage.tsx       # Anúncios filtrados por categoria
│   ├── Chat.tsx               # Chat em tempo real
│   ├── CreateAd.tsx           # Formulário de criação/edição de anúncio (com IA)
│   ├── Dashboard.tsx          # Layout do painel do usuário
│   ├── DashboardHome.tsx      # Resumo do painel do usuário
│   ├── EditProfile.tsx        # Edição de perfil
│   ├── Home.tsx               # Página inicial com busca e destaques
│   ├── Login.tsx              # Autenticação (Login / Cadastro)
│   ├── Privacy.tsx            # Política de Privacidade
│   ├── PublicProfile.tsx      # Perfil público do profissional
│   ├── Search.tsx             # Busca avançada e mapas
│   └── Terms.tsx              # Termos de Uso
├── services/                  # Camada de serviços e integração
│   ├── audit.ts               # Registrador de eventos de segurança
│   ├── geminiService.ts       # Cliente para chamadas de IA (/api/ai)
│   └── store.ts               # Camada principal de dados (Supabase + LocalStorage)
├── types.ts                   # Definições de Interfaces e Tipos TypeScript
├── App.tsx                    # Roteamento central da aplicação
├── server.js                  # Servidor Express de produção e proxy da IA
├── schema.sql                 # Script SQL completo de criação do banco Supabase
└── tailwind.config.js         # Configurações do Tailwind CSS
```

---

## ⚙️ Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto com as seguintes chaves:

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica

# Servidor Backend & Automações
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-privada
GROQ_API_KEY=gsk_sua_chave_groq_aqui
CRON_SECRET=seu_segredo_cron

# Servidor Express
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173
```

---

## 🔧 Como Executar o Projeto Localmente

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Verifique os tipos TypeScript**:
   ```bash
   npm run type-check
   ```

3. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

4. **Inicie o servidor backend (opcional para rodar o proxy da IA localmente)**:
   ```bash
   npm start
   ```

---

## 🗄️ Configuração do Banco de Dados (Supabase)

1. No painel do Supabase, acesse **SQL Editor**.
2. Abra o arquivo `schema.sql` e execute o script completo.
3. Para definir o usuário **Dono Master (Super Admin)**, rode a instrução SQL no editor:
   ```sql
   UPDATE profiles 
   SET role = 'ADMIN', is_owner = true 
   WHERE id = 'SEU_UUID_DE_USUARIO_AQUI';
   ```

---

## 📦 Scripts Disponíveis no `package.json`

- `npm run dev`: Inicia o ambiente de desenvolvimento do Vite.
- `npm run build`: Compila a aplicação para produção na pasta `dist/`.
- `npm run preview`: Visualiza o build de produção localmente.
- `npm run type-check`: Executa a verificação estática de tipos do TypeScript sem emitir arquivos.
- `npm start`: Executa o servidor de produção `server.js`.
- `npm run expire:ads`: Executa a rotina automática de expiração de anúncios.

---

## 🚢 Deploy em Produção (Railway / Docker)

O projeto inclui arquivos `nixpacks.toml` e `server.js` configurados para deploy automático no **Railway** ou em containers **Docker**:

1. Conecte o repositório Git ao Railway.
2. Defina as variáveis de ambiente no dashboard do Railway (`GROQ_API_KEY`, `VITE_SUPABASE_URL`, etc.).
3. O Railway executará `npm run build` e em seguida `npm start` para servir a aplicação pronta em produção.
