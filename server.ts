import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  const distDir = path.join(__dirname, 'dist');

  // Health check
  app.get('/healthz', (req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  const MODEL = 'llama3-8b-8192';

  /**
   * Endpoint de proxy para geração de texto via IA (Groq).
   * Responsável por classificar automaticamente serviços ou criar descrições chamativas.
   */
  app.post('/api/ai', async (req: Request, res: Response) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Chave da API Groq não configurada no servidor (Railway Env: GROQ_API_KEY).' });
      return;
    }

    const body = req.body || {};
    const title = String(body.title || '').trim();
    const category = String(body.category || '').trim();
    const keywords = String(body.keywords || '').trim();
    let prompt = '';

    if (body.task === 'category') {
      if (!title) { res.status(400).json({ error: 'Título é obrigatório' }); return; }
      prompt = `Analise o título deste serviço: "${title}". Retorne APENAS o ID da categoria mais provável desta lista (se nenhuma se encaixar, retorne 'outros'): electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly.`;
    } else {
      if (!title) { res.status(400).json({ error: 'Título é obrigatório' }); return; }
      prompt = `Você é um assistente de marketing especialista em classificados de serviços.
Escreva uma descrição atraente, profissional e formatada (pode usar markdown leve como tópicos) para um prestador de serviços.

Título do Serviço: ${title}
Categoria: ${category}
Palavras-chave/Detalhes extras: ${keywords}

Regras:
- Use português do Brasil.
- Máximo de 150 palavras.
- Foque nos benefícios para o cliente.
- Inclua uma chamada para ação (CTA) no final.`;
    }

    try {
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }]
        }),
      });

      const data: any = await r.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!r.ok || text === undefined) {
        const errMsg = data?.error?.message || data?.error || 'Erro ao gerar conteúdo com a IA do Groq.';
        console.error('Groq API error:', r.status, errMsg);
        res.status(r.ok ? 500 : 502).json({ error: errMsg });
        return;
      }

      if (body.task === 'category') {
        res.status(200).json({ category: text.trim() });
      } else {
        res.status(200).json({ text });
      }
    } catch (e) {
      console.error('Groq fetch error:', e);
      res.status(500).json({ error: 'Erro ao conectar com o serviço de IA do Groq.' });
    }
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
      price_range: 'R$ 150 a R$ 350'
    };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json(fallback);

    const prompt = `Você é um assistente técnico especialista de um marketplace de serviços residenciais (Mestrio).
O cliente tem o seguinte problema/necessidade: "${problem}".

Responda ESTRITAMENTE em formato JSON com as seguintes chaves (sem usar blocos de código ou formatação markdown, retorne a string JSON pura):
- category: A categoria mais adequada (electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly, ou outros).
- possible_issue: Uma breve descrição de 1 frase sobre o que pode ser o defeito/solução.
- price_range: Uma estimativa de preço no formato "R$ X a R$ Y".

JSON puro:`;

    try {
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }]
        }),
      });

      if (!r.ok) {
        console.warn('Groq API retornou status não-OK:', r.status);
        return res.status(200).json(fallback);
      }

      const data: any = await r.json();
      const text = data?.choices?.[0]?.message?.content || '';

      try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResponse = JSON.parse(cleanText);
        return res.status(200).json(parsedResponse);
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON do Groq:', text);
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
