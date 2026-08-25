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

  // Production-grade security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    if (process.env.NODE_ENV === 'production' || req.secure || req.get('x-forwarded-proto') === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
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
      // Mapeia termos para as slugs oficiais do Mestrio (electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly)
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

      if (apiKey) {
        const prompt = `Analise o título deste serviço: "${title}". Retorne APENAS o slug oficial mais provável desta lista exata (sem pontuação extra): electrician, plumber, painter, cleaning, handyman, moving, gardener, assembly, others`;
        const aiCategory = await callGroqChat(apiKey, prompt);
        if (aiCategory) {
          const cleanSlug = aiCategory.trim().toLowerCase().replace(/[^a-z-]/g, '');
          const validSlugs = ['electrician', 'plumber', 'painter', 'cleaning', 'handyman', 'moving', 'gardener', 'assembly', 'others'];
          if (validSlugs.includes(cleanSlug)) {
            res.status(200).json({ category: cleanSlug });
            return;
          }
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

      res.status(200).json({ category: 'handyman' });
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

    // Manifest handlers with proper Content-Type
    app.get(['/manifest.webmanifest', '/manifest.json'], (req: Request, res: Response) => {
      const webmanifestPath = path.join(distDir, 'manifest.webmanifest');
      const jsonPath = path.join(distDir, 'manifest.json');
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (fs.existsSync(webmanifestPath)) {
        return res.sendFile(webmanifestPath);
      } else if (fs.existsSync(jsonPath)) {
        return res.sendFile(jsonPath);
      }
      res.status(404).end();
    });

    // Robots.txt
    app.get('/robots.txt', (req: Request, res: Response) => {
      const robotsPath = path.join(distDir, 'robots.txt');
      if (fs.existsSync(robotsPath)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.sendFile(robotsPath);
      }
      res.status(404).end();
    });

    // Sitemap.xml
    app.get('/sitemap.xml', (req: Request, res: Response) => {
      const sitemapPath = path.join(distDir, 'sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(sitemapPath);
      }
      res.status(404).end();
    });

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

    // Serve other root static files
    app.use(express.static(distDir, {
      maxAge: '1d',
      index: false,
    }));

    // Helper para servir HTML com Open Graph dinâmico (para WhatsApp, Facebook, Telegram, etc.)
    async function serveHtmlWithOgTags(req: Request, res: Response) {
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send('Not found');
      }

      let html = fs.readFileSync(indexPath, 'utf-8');
      const urlPath = req.path;
      const host = req.get('x-forwarded-host') || req.get('host') || 'mestrio-production.up.railway.app';
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const baseUrl = `${protocol}://${host}`;

      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tdbtkmtjtkidfesgalgk.supabase.co';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey);

          let pageTitle = 'Mestrio - Serviços Gerais em Domicílio';
          let pageDesc = 'Conectando clientes aos melhores prestadores de serviços da sua região.';
          let pageImage = `${baseUrl}/favicon.png`;
          let pageType = 'website';
          let canonicalUrl = `${baseUrl}${urlPath}`;

          // 1. Caso seja Perfil de Profissional (/profissional/:id)
          if (urlPath.startsWith('/profissional/')) {
            const userId = urlPath.split('/profissional/')[1]?.split('/')[0]?.split('?')[0];
            if (userId) {
              const { data: prof } = await supabase.from('profiles').select('name, bio, avatar').eq('id', userId).maybeSingle();
              if (prof) {
                pageTitle = `${prof.name} | Profissional no Mestrio`;
                pageDesc = prof.bio 
                  ? prof.bio.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 180) 
                  : `Confira os serviços, avaliações e portfólio de ${prof.name} no Mestrio.`;
                pageImage = prof.avatar || pageImage;
                pageType = 'profile';
              }
            }
          } 
          // 2. Caso seja Anúncio de Serviço (/servico/:id)
          else if (urlPath.startsWith('/servico/')) {
            const adId = urlPath.split('/servico/')[1]?.split('/')[0]?.split('?')[0];
            if (adId) {
              const { data: ad } = await supabase
                .from('service_ads')
                .select('title, description, photos, image_url, price, location, profiles:provider_id(name, avatar)')
                .eq('id', adId)
                .maybeSingle();

              if (ad) {
                pageTitle = `${ad.title} | Mestrio`;
                const profData = Array.isArray(ad.profiles) ? ad.profiles[0] : ad.profiles;
                const providerName = profData?.name ? ` por ${profData.name}` : '';
                const priceText = ad.price ? ` - A partir de R$ ${ad.price}` : '';
                pageDesc = ad.description 
                  ? `${ad.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 150)}${priceText}${providerName}`
                  : `Contrate ${ad.title}${providerName} com segurança e garantia no Mestrio.`;
                
                // Pega foto do anúncio ou avatar do prestador
                const firstPhoto = (Array.isArray(ad.photos) && ad.photos.length > 0) ? ad.photos[0] : (ad.image_url || profData?.avatar);
                if (firstPhoto) pageImage = firstPhoto;
                pageType = 'article';
              }
            }
          }

          // Garante que a URL da imagem seja absoluta
          if (pageImage && !pageImage.startsWith('http://') && !pageImage.startsWith('https://')) {
            pageImage = pageImage.startsWith('/') ? `${baseUrl}${pageImage}` : `${baseUrl}/${pageImage}`;
          }

          // Remove tags antigas para evitar duplicidade no parser de robôs do WhatsApp/Facebook
          html = html.replace(/<title>[\s\S]*?<\/title>/gi, '');
          html = html.replace(/<meta\s+(name|property)=["'](description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '');

          const newMetaTags = `
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDesc}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:site_name" content="Mestrio" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDesc}" />
    <meta property="og:image" content="${pageImage}" />
    <meta property="og:image:secure_url" content="${pageImage}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="${pageType}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${pageDesc}" />
    <meta name="twitter:image" content="${pageImage}" />
`;

          html = html.replace(/<head>/i, `<head>${newMetaTags}`);
        }
      } catch (err) {
        console.warn('Erro ao processar OG tags dinâmicas:', err);
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(html);
    }

    // SPA fallback
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api/')) return next();

      const ext = path.extname(req.path);
      if (ext && ['.js', '.css', '.map', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.svg', '.ico', '.json', '.webmanifest', '.txt', '.xml'].includes(ext)) {
        res.status(404).json({ error: 'Asset não encontrado. Faça um hard reload (Ctrl+Shift+R).' });
        return;
      }

      serveHtmlWithOgTags(req, res);
    });
  }

  // Global error handler middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Server Error]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mestrio server rodando na porta ${PORT}`);
    ensureStorageBuckets();
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] Recebido sinal ${signal}. Finalizando conexões graciosamente...`);
    server.close(() => {
      console.log('[Server] Servidor Express finalizado com sucesso.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[Server] Timeout no encerramento gracioso. Forçando encerramento.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
