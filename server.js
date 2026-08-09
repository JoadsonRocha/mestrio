// Servidor de produção para o Railway:
// serve o build (dist/) com fallback SPA + endpoints de API (/api/ai, /api/expire-ads) + healthcheck.
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;
const requestCounts = new Map();

function getClientKey(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const key = getClientKey(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const entries = (requestCounts.get(key) || []).filter((ts) => ts > windowStart);
  entries.push(now);
  requestCounts.set(key, entries);

  if (entries.length > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'Muitas requisições. Tente novamente mais tarde.' });
    return;
  }

  next();
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(rateLimit);

// Headers de segurança + CSP (substitui helmet; evita dependência extra).
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
      console.error('Groq API error:', r.status, data?.error || data);
      res.status(r.ok ? 500 : 502).json({ error: 'Erro ao gerar conteúdo com IA.' });
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
app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Mestrio server rodando na porta ${port}`);
});
