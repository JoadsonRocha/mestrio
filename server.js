// Servidor de produção para o Railway:
// serve o build (dist/) com fallback SPA + endpoints de API (/api/ai, /api/expire-ads) + healthcheck.
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1); // Essencial para proxies como Railway (lê o X-Forwarded-For corretamente em req.ip)
app.disable('x-powered-by');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300; // 300 chamadas de API por IP a cada 15 min
const requestCounts = new Map();

// Limpeza periódica do Map para evitar vazamento de memória com IPs inativos
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

function getClientKey(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  // Rate limit aplica-se APENAS para rotas da API (/api/*), nunca para assets estáticos, HTML ou favicons
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

// CORS: Permite a origem configurada ou flexibiliza em produção para requisições do próprio domínio/Railway
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : true;
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(rateLimit);

// Headers de segurança + CSP (substitui helmet; evita dependência extra).
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.bigdatacloud.net https://*.api-bdc.io https://api-bdc.io https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://api.groq.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

const distDir = path.join(__dirname, 'dist');

// Health check usado pelo Railway
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// ----------------------------------------------------------------
// /api/ai — proxy para o Groq
// ----------------------------------------------------------------
const MODEL = 'llama3-8b-8192'; // Modelo gratuito rápido do Groq

app.post('/api/ai', async (req, res) => {
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

    const data = await r.json();
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

// ----------------------------------------------------------------
// /api/ai/estimate — Orçador Inteligente
// ----------------------------------------------------------------
app.post('/api/ai/estimate', async (req, res) => {
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

    const data = await r.json();
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

// ----------------------------------------------------------------
// /api/expire-ads — expira anúncios (uso do cron / disparos externos)
// Requer SUPABASE_SERVICE_ROLE_KEY E CRON_SECRET: a chamada precisa do
// header `x-cron-secret` (ou `?secret=`). Sem CRON_SECRET configurada,
// o endpoint fica desabilitado (503) — nunca aberto para o público.
// ----------------------------------------------------------------
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

app.post('/api/expire-ads', async (req, res) => {
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

// ----------------------------------------------------------------
// SPA: serve os arquivos do dist/ e cai no index.html para rotas do React
// ----------------------------------------------------------------

// Assets com hash no nome (js, css, woff2, etc.) → cache imutável 1 ano
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  maxAge: '1y',
  immutable: true,
  fallthrough: false, // Retorna 404 para assets não encontrados (nunca retorna HTML)
}));

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  const icoPath = path.join(distDir, 'favicon.ico');
  const pngPath = path.join(distDir, 'favicon.png');
  if (fs.existsSync(icoPath)) {
    return res.sendFile(icoPath);
  } else if (fs.existsSync(pngPath)) {
    return res.sendFile(pngPath);
  }
  res.status(404).end();
});

// Arquivos raiz (favicon, manifest, etc.) → sem cache
app.use(express.static(distDir, { maxAge: 0 }));

// SPA fallback: apenas para rotas GET que NÃO são arquivos estáticos
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return next();

  // Se o caminho tem extensão de arquivo estático, retorna 404 (não devolve HTML)
  const ext = path.extname(req.path);
  if (ext && ['.js', '.css', '.map', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.svg', '.ico'].includes(ext)) {
    res.status(404).json({ error: 'Asset não encontrado. Faça um hard reload (Ctrl+Shift+R).' });
    return;
  }

  // Para todas as outras rotas: servir o index.html SEM cache (garante que o browser
  // sempre pegue o index.html mais recente com os hashes corretos dos chunks)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(distDir, 'index.html'));
});

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
  } catch (e) {
    console.warn('[Storage] Erro na verificação automática de buckets:', e.message);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Mestrio server rodando na porta ${port}`);
  ensureStorageBuckets();
});
