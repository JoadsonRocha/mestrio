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
    return data.text || 'Não foi possível gerar a descrição.';
  } catch (error) {
    console.error("Groq AI Error:", error);
    return "Erro ao gerar descrição. Tente escrever manualmente.";
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
