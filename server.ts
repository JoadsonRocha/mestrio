import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

/**
 * Inicializa e configura o servidor Express responsável pela API do backend.
 * Inclui configurações de proxy, segurança, rotas e serving do frontend.
 */
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
  const RATE_LIMIT_MAX_REQUESTS = 300;
  const requestCounts = new Map<string, number[]>();

  // Periodically clean request counts to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    for (const [key, entries] of requestCounts.entries()) {
      const valid = entries.filter((ts) => ts > windowStart);
      if (valid.length === 0) {
        requestCounts.delete(key);
      } else {
        requestCounts.set(key, valid);
      }
    }
  }, 10 * 60 * 1000);

  function getClientKey(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : (Array.isArray(forwarded) ? forwarded[0] : req.ip);
    return ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Middleware para limitar o número de requisições e evitar abusos (Rate Limiting).
   * Restringe chamadas excessivas baseando-se no IP do cliente.
   */
  function rateLimit(req: Request, res: Response, next: NextFunction) {
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    const key = getClientKey(req);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const entries = (requestCounts.get(key) || []).filter((ts) => ts > windowStart);
    entries.push(now);
    requestCounts.set(key, entries);

    if (entries.length > RATE_LIMIT_MAX_REQUESTS) {
      res.status(429).json({ error: 'Muitas requisições para a API. Tente novamente mais tarde.' });
      return;
    }

    next();
  }

  app.use(express.json({ limit: '1mb' }));

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : true;
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  app.use(rateLimit);

  // Security headers compatible with AI Studio preview frames
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const distDir = path.join(process.cwd(), 'dist');

  // Health check
  app.get('/healthz', (req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];

  // Função auxiliar para chamar a API Groq com fallback automático de modelos
  async function callGroqChat(apiKey: string, prompt: string): Promise<string | null> {
    for (const model of GROQ_MODELS) {
      try {
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const r = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 600,
          }),
        });

        if (!r.ok) {
          console.warn(`[Groq AI] Modelo ${model} falhou com status ${r.status}, tentando próximo...`);
          continue;
        }

        const data: any = await r.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      } catch (err) {
        console.warn(`[Groq AI] Erro ao chamar modelo ${model}:`, err);
      }
    }
    return null;
  }

  /**
   * Endpoint de proxy para geração de texto via IA (Groq).
   * Responsável por classificar automaticamente serviços ou criar descrições chamativas.
   */
  app.post('/api/ai', async (req: Request, res: Response) => {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const category = String(body.category || '').trim();
    const keywords = String(body.keywords || '').trim();

    if (!title) {
      res.status(400).json({ error: 'Título é obrigatório' });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;

    // Fallback inteligente caso a chave não esteja configurada ou o Groq esteja indisponível
    const generateLocalDescription = () => {
      const extra = keywords ? `\n\n📌 **Especialidades & Diferenciais:**\n${keywords.split(/[,;\n]+/).filter(Boolean).map(k => `• ${k.trim()}`).join('\n')}` : '';
      return `Ofereço serviços profissionais de alta qualidade e com garantia técnica para **${title}**.\n\n` +
        `✅ Atendimento pontual e transparente;\n` +
        `✅ Execução limpa, organizada e com ferramentas adequadas;\n` +
        `✅ Orçamento sem compromisso com excelente custo-benefício.` +
        extra +
        `\n\n💬 *Fale comigo agora pelo WhatsApp para tirar dúvidas e agendar seu atendimento!*`;
    };

    if (body.task === 'category') {
      const categoryMap: Record<string, string> = {
        'eletric': 'eletricista',
        'eletro': 'eletricista',
        'tomada': 'eletricista',
        'fio': 'eletricista',
        'cano': 'encanador',
        'vaza': 'encanador',
        'pia': 'encanador',
        'esgoto': 'encanador',
        'hidraul': 'encanador',
        'pint': 'pintura',
        'tinta': 'pintura',
        'muro': 'pintura',
        'limp': 'limpeza',
        'faxin': 'limpeza',
        'diarista': 'limpeza',
        'ar ': 'ar-condicionado',
        'ar-': 'ar-condicionado',
        'split': 'ar-condicionado',
        'inverter': 'ar-condicionado',
        'obra': 'pedreiro',
        'reforma': 'pedreiro',
        'piso': 'pedreiro',
        'porcelanato': 'pedreiro',
        'movel': 'marcenaria',
        'móvel': 'marcenaria',
        'armario': 'marcenaria',
        'marceneiro': 'marcenaria',
      };

      if (apiKey) {
        const prompt = `Analise o título deste serviço: "${title}". Retorne APENAS o slug da categoria mais provável desta lista (se nenhuma se encaixar, retorne 'outros'): eletricista, encanador, pintura, limpeza, ar-condicionado, pedreiro, marcenaria, outros.`;
        const aiCategory = await callGroqChat(apiKey, prompt);
        if (aiCategory) {
          res.status(200).json({ category: aiCategory.trim().toLowerCase().replace(/[^a-z-]/g, '') });
          return;
        }
      }

      // Fallback local por palavras-chave no título
      const lowerTitle = title.toLowerCase();
      for (const [key, slug] of Object.entries(categoryMap)) {
        if (lowerTitle.includes(key)) {
          res.status(200).json({ category: slug });
          return;
        }
      }

      res.status(200).json({ category: 'outros' });
      return;
    }

    // Task describe
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
        res.status(200).json({ text: aiText.trim() });
        return;
      }
    }

    // Se não houver API Key ou chamada falhar, retorna o gerador contextualizado
    res.status(200).json({ text: generateLocalDescription() });
  });

  /**
   * Endpoint do Smart Estimator.
   * Utiliza a IA (Groq) para estimar um problema, sugerir uma categoria e fornecer 
   * uma margem de preço aproximada com base no relato do usuário.
   */
  app.post('/api/ai/estimate', async (req: Request, res: Response) => {
    const body = req.body || {};
    const problem = String(body.problem || '').trim();
    
    if (!problem) return res.status(400).json({ error: 'O problema é obrigatório' });

    const fallback = {
      category: 'handyman',
      possible_issue: `Serviço recomendado para solucionar: ${problem}`,
      price_range: 'R$ 150 a R$ 350',
      estimated_time: '1 dia',
      recommended_materials: ['Materiais básicos de instalação / reparo']
    };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json(fallback);

    const prompt = `Você é um assistente técnico especialista de um marketplace de serviços residenciais (Mestrio).
O cliente tem o seguinte problema/necessidade: "${problem}".

Responda ESTRITAMENTE em formato JSON com as seguintes chaves (sem usar blocos de código ou formatação markdown, retorne a string JSON pura):
- category: A categoria mais adequada (electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly, ou outros).
- possible_issue: Uma breve descrição de 1 frase sobre o que pode ser o defeito/solução.
- price_range: Uma estimativa de preço no formato "R$ X a R$ Y".
- estimated_time: Prazo estimado (ex: "1 a 2 dias", "4 horas").
- recommended_materials: Array de strings com 1 a 3 materiais prováveis necessários.

JSON puro:`;

    try {
      const text = await callGroqChat(apiKey, prompt);
      if (!text) return res.status(200).json(fallback);

      try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResponse = JSON.parse(cleanText);
        return res.status(200).json(parsedResponse);
      } catch (parseError) {
        console.warn('Fallback: Erro ao fazer parse do JSON do Groq:', text);
        return res.status(200).json(fallback);
      }
    } catch (e) {
      console.error('Groq estimate fetch error:', e);
      return res.status(200).json(fallback);
    }
  });

  /**
   * Executa a expiração de anúncios que ultrapassaram a data limite configurada.
   * Atualiza o status para 'expired' no banco de dados.
   * 
   * @returns O número de anúncios que foram expirados.
   */
  async function expireAds() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');

    const url = process.env.VITE_SUPABASE_URL || 'https://tdbtkmtjtkidfesgalgk.supabase.co';
    const supabase = createClient(url, serviceKey);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('service_ads')
      .update({ status: 'expired' })
      .eq('status', 'approved')
      .lt('expires_at', now)
      .select('id');
    if (error) throw error;
    return (data || []).length;
  }

  // Cron / External triggers to expire ads
  app.post('/api/expire-ads', async (req: Request, res: Response) => {
    if (!req.get('x-cron-secret') && !req.query.secret) {
      res.status(401).json({ error: 'Não autorizado.' });
      return;
    }

    const secret = process.env.CRON_SECRET;
    if (!secret) {
      res.status(503).json({ error: 'CRON_SECRET não configurada no servidor.' });
      return;
    }
    const provided = req.headers['x-cron-secret'] || req.query.secret;
    if (provided !== secret) {
      res.status(401).json({ error: 'Não autorizado.' });
      return;
    }
    try {
      const count = await expireAds();
      res.status(200).json({ ok: true, expired: count });
    } catch (e) {
      console.error('expire-ads error:', e);
      res.status(500).json({ error: 'Falha ao expirar anúncios.' });
    }
  });

  /**
   * Verifica a existência dos buckets necessários de storage no Supabase ('ad-images' e 'avatars').
   * Cria-os publicamente caso não existam, simplificando a inicialização do projeto em novos ambientes.
   */
  async function ensureStorageBuckets() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.VITE_SUPABASE_URL || 'https://tdbtkmtjtkidfesgalgk.supabase.co';
    if (!serviceKey || !url) return;

    try {
      const supabase = createClient(url, serviceKey);
      const buckets = ['ad-images', 'avatars'];
      for (const b of buckets) {
        const { data: bucket, error } = await supabase.storage.getBucket(b);
        if (error || !bucket) {
          console.log(`[Storage] Bucket '${b}' não encontrado. Criando bucket público automaticamente...`);
          const { error: createErr } = await supabase.storage.createBucket(b, {
            public: true,
            fileSizeLimit: 5242880,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
          });
          if (createErr) console.error(`[Storage] Erro ao criar bucket '${b}':`, createErr.message);
          else console.log(`[Storage] Bucket '${b}' criado com sucesso e tornado público!`);
        }
      }
    } catch (e: any) {
      console.warn('[Storage] Erro na verificação automática de buckets:', e.message);
    }
  }

  // Vite development vs production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets with long-term cache
    app.use('/assets', express.static(path.join(distDir, 'assets'), {
      maxAge: '1y',
      immutable: true,
      fallthrough: false,
    }));

    // Favicon handler
    app.get('/favicon.ico', (req: Request, res: Response) => {
      const icoPath = path.join(distDir, 'favicon.ico');
      const pngPath = path.join(distDir, 'favicon.png');
      if (fs.existsSync(icoPath)) {
        return res.sendFile(icoPath);
      } else if (fs.existsSync(pngPath)) {
        return res.sendFile(pngPath);
      }
      res.status(404).end();
    });

    app.use(express.static(distDir, { maxAge: 0 }));

    // SPA fallback
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api/')) return next();

      const ext = path.extname(req.path);
      if (ext && ['.js', '.css', '.map', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.svg', '.ico'].includes(ext)) {
        res.status(404).json({ error: 'Asset não encontrado. Faça um hard reload (Ctrl+Shift+R).' });
        return;
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mestrio server rodando na porta ${PORT}`);
    ensureStorageBuckets();
  });
}

startServer();
