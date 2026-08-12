# Módulo Admin - Mestrio

Este módulo contém toda a lógica, componentes e visualizações do **Painel Administrativo / Painel do Dono** do Mestrio.

---

## 🛠️ Como extrair este módulo para um repositório independente no futuro

Quando você decidir transformar o Admin em um projeto 100% independente (ex: `mestrio-admin`), siga este passo a passo simples:

### 1. Criar novo projeto React + Vite
```bash
npx -y create-vite@latest mestrio-admin --template react-ts
cd mestrio-admin
npm install react-router-dom lucide-react @supabase/supabase-js
```

### 2. Copiar os arquivos necessários
Copie para o novo repositório:
* A pasta `admin/`
* As interfaces compartilhadas (`types.ts`)
* Os serviços de comunicação do banco de dados (`services/store.ts` / `services/supabase.ts`)
* O contexto de Auth e Toast (`context/AuthContext.tsx`, `context/ToastContext.tsx`)

### 3. Configurar Variáveis de Ambiente
No novo projeto, crie um arquivo `.env` com a mesma URL e Chave do Supabase usadas no app principal:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 4. Remover do App Principal (Opcional)
Após migrar para o novo repositório, você pode simplesmente apagar a pasta `admin/` deste repositório e remover a rota `/owner` no `App.tsx`.

---

### 📌 Dica de Segurança
No projeto separado, garanta que o acesso ao subdomínio (ex: `admin.mestrio.com`) seja restrito e exija autenticação com perfil `ADMIN` no Supabase Auth + RLS.
