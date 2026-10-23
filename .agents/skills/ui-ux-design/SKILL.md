---
name: ui-ux-design
description: Use when designing, building, auditing, or refactoring user interfaces, components, visual hierarchies, responsive layouts, design systems, accessibility (WCAG), or user interaction flows
---

# UI/UX Design & Interface Engineering (Mestrio)

Guia de referência mestre para engenharia de interfaces modernas, arquitetura de experiência do usuário (UX), sistemas visuais (Design Systems) e conformidade com acessibilidade digital (WCAG 2.2 AA).

---

## 1. Princípios Fundamentais (Anti-Slop Guidelines)

1. **Intencionalidade Visual**: Toda escolha visual (cor, espaçamento, tipografia, raio de borda) deve ter propósito funcional e semântico. Evite decorações aleatórias ou gradientes desconexos.
2. **Hierarquia Clara (Foco do Olho)**: O usuário deve compreender em menos de 3 segundos:
   - *Onde estou?*
   - *Qual é a informação mais importante?*
   - *Qual é a próxima ação recomendada (Primary CTA)?*
3. **Respeito à Densidade e Respiro**: Espaço em branco (whitespace) não é espaço vazio; é uma ferramenta de agrupamento cognitivo (Lei da Proximidade de Gestalt).
4. **Design Mobile-First Real**: Interfaces para toque, polegares acessíveis, sem menus ocultos sem necessidade e sem scroll horizontal acidental.

---

## 2. Sistema de Cores e Contraste

### Regra 60-30-10
- **60% Superfície/Fundo**: Tons neutros dominantes (ex: `#f9fafb` no claro, `#0f172a` no escuro).
- **30% Estrutura & Conteúdo**: Cartões, divisores sutis, tipografia primária e secundária.
- **10% Acento (Action Color)**: Apenas para ações primárias, links ativos, badges de status e indicadores de foco.

### Requisitos Estritos de Contraste (WCAG 2.2)
- **Texto Normal (< 18pt / < 24px regular)**: Contraste mínimo de **4.5:1** contra o fundo.
- **Texto Grande (≥ 18pt ou ≥ 14pt bold)**: Contraste mínimo de **3:1**.
- **Controles de Interface e Ícones Interativos**: Contraste mínimo de **3:1** com os estados adjacentes.
- **Acessibilidade em Cores**: **NUNCA** transmita significado exclusivamente pela cor (ex: além de vermelho em erros, inclua texto ou ícone de alerta explicativo).

---

## 3. Tipografia e Escala Modular

### Escala Recomendada (Base 16px / 1rem)
- `Display / Hero`: 36px a 48px (`text-4xl` a `text-5xl`), `font-bold`, `leading-tight`, `tracking-tight`.
- `H1 (Page Title)`: 28px a 32px (`text-2xl` a `text-3xl`), `font-bold`, `leading-snug`.
- `H2 (Section)`: 20px a 24px (`text-xl` a `text-2xl`), `font-semibold`.
- `H3 / Card Title`: 16px a 18px (`text-base` a `text-lg`), `font-semibold`.
- `Body (Texto principal)`: 15px ou 16px (`text-base`), `leading-relaxed` (line-height ~1.5 a 1.6).
- `Caption / Metadata`: 12px a 13px (`text-xs` a `text-sm`), `leading-normal`, cores com contraste garantido.
- **Limite Mínimo**: Nunca utilize texto legível menor que **12px**.

---

## 4. Layout, Espaçamento e Grids

### Sistema de Espaçamento Base 4px / 8px
Utilize múltiplos de 4px e 8px para consistência absoluta:
- `4px` (0.25rem): Espaçamentos mínimos (ícone + label, badges).
- `8px` (0.5rem): Espaço interno de inputs compactos, gaps entre chips.
- `12px` (0.75rem): Padding interno padrão de botões e itens de lista.
- `16px` (1rem): Padding padrão de cartões mobile, margem entre elementos de formulário.
- `24px` (1.5rem): Espaçamento entre seções em telas móveis, padding de cartões desktop.
- `32px` a `48px`: Distância entre blocos maiores e cabeçalhos de página.

### Limite de Largura de Leitura
Para blocos de texto longo (artigos, termos, descrições detalhadas), limite o container entre **60 a 75 caracteres por linha** (`max-w-prose` ou ~680px) para evitar fadiga ocular.

---

## 5. Engenharia de Interação & Micro-UX

### Alvos de Toque (Touch Targets)
- Em dispositivos móveis, qualquer elemento clicável (botão, link, ícone de fechar, checkbox) deve possuir área interativa mínima de **44 × 44px** (iOS) ou **48 × 48px** (Android).
- Se o ícone visual tiver 20px, use padding ou elemento invisível para expandir o alvo de toque.

### Estados Obrigatórios de Todo Componente Interativo
Todo elemento clicável deve possuir explicitamente 6 estados projetados:
1. **Default**: Limpo, convidativo e com contraste adequado.
2. **Hover (Desktop)**: Indicação sutil de elevação ou alteração de tonalidade (ex: `hover:bg-blue-700`).
3. **Focus-Visible**: Anel de foco nítido para navegação por teclado (`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600`). **NUNCA oculte `outline: none` sem um substituto `focus-visible`**.
4. **Active / Pressed**: Resposta tátil ao clique ou toque (`active:scale-[0.98]`).
5. **Loading**: Feedback assíncrono (spinner ou skeleton) com desabilitação temporária contra cliques múltiplos.
6. **Disabled**: Opacidade reduzida (`disabled:opacity-50 disabled:cursor-not-allowed`) e `aria-disabled="true"`.

### Animações e Transições
- **Duração Ideal**: Micro-interações entre **150ms e 250ms**. Modais e drawers entre **250ms e 350ms**.
- **Curva de Timing**: Prefira `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) ou `ease-out` para entradas, trazendo sensação de rapidez e naturalidade.
- **Respeito ao Usuário**: Sempre respeite preferências de redução de movimento:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 6. Formulários & Prevenção de Erros

1. **Labels Visíveis**: Placeholders **NUNCA** devem substituir a tag `<label>`. O placeholder desaparece ao digitar e causa perda de contexto.
2. **Validação Inline e Contextual**: Mostre erros diretamente abaixo do campo afetado com ícone e texto claro (ex: *"Informe um telefone com DDD válido"* em vez de apenas *"Campo inválido"*).
3. **Teclados Mobile Nativos**:
   - Telefone: `<input type="tel" inputmode="tel" />`
   - Valores numéricos: `<input type="text" inputmode="numeric" />`
   - E-mail: `<input type="email" inputmode="email" autocomplete="email" />`
4. **Feedback de Sucesso**: Confirmações visíveis imediatas (Toasts, alertas ou atualização de lista).

---

## 7. Estados Vazios (Empty States) & Skeletons

- **Empty States**: Devem conter:
  1. Ilustração ou ícone contextualizado e amigável.
  2. Título explicativo (ex: *"Nenhum anúncio encontrado"*).
  3. Mensagem orientando o próximo passo (ex: *"Tente ajustar os filtros ou pesquisar por outra categoria"*).
  4. Botão de ação (ex: *"Limpar filtros"* ou *"Criar novo anúncio"*).
- **Loading Skeletons**: Evite spinners genéricos de tela cheia. Utilize skeletons estruturais que espelham o layout real que está sendo carregado, reduzindo a percepção de espera.
- **Anti-CLS (Layout Shift)**: Sempre defina `aspect-ratio` ou dimensões reservadas para imagens e cards antes do carregamento.

---

## 8. Checklist de Validação de Interface (Pré-Entrega)

Antes de considerar uma tela ou componente finalizado, audite:
- [ ] **Sem scroll horizontal indesejado** em telas de 320px, 375px e 414px.
- [ ] **Contraste de texto validado** (mínimo 4.5:1 para corpo e labels).
- [ ] **Navegação por teclado** (Tab caminha logicamente por todos os botões e inputs; Esc fecha modais).
- [ ] **Labels acessíveis em botões de ícone** (`aria-label="Fechar modal"`, etc.).
- [ ] **Feedback de clique duplo prevenido** em botões de salvar, pagar ou enviar.
- [ ] **Skip Link funcional** (`#skip-link`) para pular direto ao conteúdo principal.
- [ ] **Imagens com `alt` descritivo** (ou `alt=""` para puramente decorativas).
