interface Env {
  GROQ_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768'
];

async function callGroqChat(apiKey: string, prompt: string): Promise<string | null> {
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (!res.ok) continue;

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch {
      // Ignora e tenta o próximo modelo
    }
  }
  return null;
}

const jsonResponse = (data: unknown, status: number = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPost(context: PagesContext) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const problem = String(body?.problem || '').trim().slice(0, 500);

    if (!problem) {
      return jsonResponse({ error: 'O problema é obrigatório' }, 400);
    }

    const fallback = {
      category: 'handyman',
      possible_issue: `Serviço recomendado para solucionar: ${problem}`,
      price_range: 'R$ 150 a R$ 350',
      estimated_time: '1 dia',
      recommended_materials: ['Materiais básicos de instalação / reparo']
    };

    const apiKey = context.env.GROQ_API_KEY;
    if (!apiKey) {
      return jsonResponse(fallback);
    }

    const prompt = `Você é um assistente técnico especialista de um marketplace de serviços residenciais (Mestrio).
O cliente tem o seguinte problema/necessidade: "${problem}".

Responda ESTRITAMENTE em formato JSON com as seguintes chaves (sem usar blocos de código ou formatação markdown, retorne a string JSON pura):
- category: A categoria mais adequada (electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly, ou outros).
- possible_issue: Uma breve descrição de 1 frase sobre o que pode ser o defeito/solução.
- price_range: Uma estimativa de preço no formato "R$ X a R$ Y".
- estimated_time: Prazo estimado (ex: "1 a 2 dias", "4 horas").
- recommended_materials: Array de strings com 1 a 3 materiais prováveis necessários.

JSON puro:`;

    const text = await callGroqChat(apiKey, prompt);
    if (!text) {
      return jsonResponse(fallback);
    }

    try {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      return jsonResponse(parsed);
    } catch {
      return jsonResponse(fallback);
    }
  } catch {
    return jsonResponse({ error: 'Erro ao gerar estimativa' }, 500);
  }
}
