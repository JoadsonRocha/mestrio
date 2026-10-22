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

const categoryMap: Record<string, string> = {
  'eletric': 'electrician',
  'eletro': 'electrician',
  'tomada': 'electrician',
  'fio': 'electrician',
  'disjuntor': 'electrician',
  'cano': 'plumber',
  'vaza': 'plumber',
  'pia': 'plumber',
  'esgoto': 'plumber',
  'hidraul': 'plumber',
  'desentup': 'plumber',
  'torneira': 'plumber',
  'pint': 'painter',
  'tinta': 'painter',
  'muro': 'painter',
  'massa': 'painter',
  'verniz': 'painter',
  'limp': 'cleaning',
  'faxin': 'cleaning',
  'diarista': 'cleaning',
  'higieniz': 'cleaning',
  'ar ': 'handyman',
  'ar-': 'handyman',
  'split': 'handyman',
  'inverter': 'handyman',
  'obra': 'handyman',
  'reforma': 'handyman',
  'piso': 'handyman',
  'porcelanato': 'handyman',
  'marido': 'handyman',
  'reparo': 'handyman',
  'conserto': 'handyman',
  'mudan': 'moving',
  'carreto': 'moving',
  'frete': 'moving',
  'transporte': 'moving',
  'jardim': 'gardener',
  'grama': 'gardener',
  'poda': 'gardener',
  'planta': 'gardener',
  'movel': 'assembly',
  'móvel': 'assembly',
  'armario': 'assembly',
  'guarda-roupa': 'assembly',
  'montad': 'assembly',
  'montag': 'assembly',
};

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
      // Tenta próximo modelo em caso de falha de conexão/timeout
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
    const title = String(body?.title || '').trim().slice(0, 150);
    const category = String(body?.category || '').trim().slice(0, 50);
    const keywords = String(body?.keywords || '').trim().slice(0, 300);

    if (!title) {
      return jsonResponse({ error: 'Título é obrigatório' }, 400);
    }

    const apiKey = context.env.GROQ_API_KEY;

    const generateLocalDescription = () => {
      const extra = keywords
        ? `\n\n📌 **Especialidades & Diferenciais:**\n${keywords.split(/[,;\n]+/).filter(Boolean).map((k: string) => `• ${k.trim()}`).join('\n')}`
        : '';
      return (
        `Ofereço serviços profissionais de alta qualidade e com garantia técnica para **${title}**.\n\n` +
        `✅ Atendimento pontual e transparente;\n` +
        `✅ Execução limpa, organizada e com ferramentas adequadas;\n` +
        `✅ Orçamento sem compromisso com excelente custo-benefício.` +
        extra +
        `\n\n💬 *Fale comigo agora pelo WhatsApp para tirar dúvidas e agendar seu atendimento!*`
      );
    };

    if (body.task === 'category') {
      if (apiKey) {
        const prompt = `Analise o título deste serviço: "${title}". Retorne APENAS o slug oficial mais provável desta lista exata (sem pontuação extra): electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly, others`;
        const aiCategory = await callGroqChat(apiKey, prompt);
        if (aiCategory) {
          const cleanSlug = aiCategory.trim().toLowerCase().replace(/[^a-z-]/g, '');
          const validSlugs = ['electrician', 'plumber', 'painter', 'cleaning', 'handyman', 'moving', 'gardener', 'assembly', 'others'];
          if (validSlugs.includes(cleanSlug)) {
            return jsonResponse({ category: cleanSlug });
          }
        }
      }

      const lowerTitle = title.toLowerCase();
      for (const [key, slug] of Object.entries(categoryMap)) {
        if (lowerTitle.includes(key)) {
          return jsonResponse({ category: slug });
        }
      }

      return jsonResponse({ category: 'handyman' });
    }

    // Default: geração de descrição
    if (apiKey) {
      const prompt = `Você é um assistente de marketing especialista em anúncios de serviços profissionais (Mestrio).
Escreva uma descrição atraente, profissional, acolhedora e bem formatada com tópicos/bullet points para o seguinte serviço:

Título do Serviço: ${title}
Categoria: ${category || 'Serviços Gerais'}
Palavras-chave/Diferenciais do Prestador: ${keywords || 'Pontualidade, Qualidade e Garantia'}

Regras Estritas:
- Escreva em português do Brasil natural e envolvente.
- Destaque os benefícios e segurança para o cliente contratante.
- Use tópicos claros com emojis profissionais (ex: ✅, 🛠️, 🛡️).
- Finalize com uma chamada acolhedora para contato pelo WhatsApp.
- Não mencione preços fixos se não foram informados.`;

      const aiText = await callGroqChat(apiKey, prompt);
      if (aiText) {
        return jsonResponse({ text: aiText.trim() });
      }
    }

    return jsonResponse({ text: generateLocalDescription() });
  } catch (err: any) {
    return jsonResponse({ error: 'Erro interno ao processar requisição de IA' }, 500);
  }
}
