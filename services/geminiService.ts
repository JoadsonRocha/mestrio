import { logSecurityWarning } from './audit';

const AI_ENDPOINT = '/api/ai';

/**
 * Interface que define a resposta esperada da API de inteligência artificial.
 */
interface AIResponse {
  text?: string;
  category?: string;
  error?: string;
}

/**
 * Função utilitária para fazer requisições POST para o endpoint local de IA.
 * 
 * @param body - Corpo da requisição contendo os parâmetros (ex: task, title, etc).
 * @returns Uma Promise com a resposta tipada `AIResponse`.
 * @throws Dispara um erro caso a chamada falhe (status HTTP != 2xx).
 */
const request = async (body: unknown, timeoutMs: number = 15000): Promise<AIResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data: AIResponse = await res.json();
    if (!res.ok) {
      logSecurityWarning('ai.request_failed', 'Falha na chamada da IA', { status: res.status, body });
      throw new Error(data.error || 'Erro no serviço de IA.');
    }
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Tempo limite de resposta da IA excedido.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fallbackDescription = (title: string, category?: string, keywords?: string): string => {
  const extra = keywords ? `\n\n📌 **Diferenciais & Especialidades:**\n${keywords.split(/[,;\n]+/).filter(Boolean).map(k => `• ${k.trim()}`).join('\n')}` : '';
  return `Ofereço serviços profissionais de alta qualidade e com garantia técnica para **${title.trim()}**.\n\n` +
    `✅ Atendimento com pontualidade e transparência;\n` +
    `✅ Execução limpa, organizada e com ferramentas adequadas;\n` +
    `✅ Orçamento sem compromisso e preço justo.` +
    extra +
    `\n\n💬 *Fale comigo pelo WhatsApp para tirar dúvidas e agendar o seu atendimento!*`;
};

/**
 * Gera uma descrição automática para um serviço usando IA, baseando-se no título, categoria e palavras-chave.
 * 
 * @param title - Título do anúncio do serviço.
 * @param category - Categoria do serviço.
 * @param keywords - Palavras-chave ou detalhes adicionais.
 * @returns Uma Promise contendo o texto gerado pela IA ou uma mensagem de erro fallback.
 */
export const generateServiceDescription = async (title: string, category: string, keywords: string): Promise<string> => {
  try {
    const data = await request({ task: 'describe', title, category, keywords });
    if (data.text && data.text.trim()) {
      return data.text;
    }
    return fallbackDescription(title, category, keywords);
  } catch (error) {
    console.warn("Groq AI Warning [Falling back to template]:", error);
    return fallbackDescription(title, category, keywords);
  }
};

/**
 * Sugere automaticamente a melhor categoria (slug) para um serviço com base no título fornecido.
 * 
 * @param title - Título do serviço.
 * @returns Uma Promise contendo a slug da categoria sugerida ou string vazia em caso de falha.
 */
export const suggestCategory = async (title: string): Promise<string> => {
  try {
    const data = await request({ task: 'category', title });
    return data.category || '';
  } catch (e) {
    return "";
  }
};

