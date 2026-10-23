/**
 * Entrypoint do Cloudflare Worker (deploy via `wrangler deploy`).
 *
 * - Rotas `/api/*` são tratadas aqui (equivalentes às rotas do `server.ts`).
 * - Qualquer outra requisição é servida pelos assets estáticos do build do Vite (`dist/`),
 *   com fallback de SPA configurado no `wrangler.jsonc`.
 *
 * Segredos (GROQ_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET) ficam apenas no ambiente
 * do Worker e nunca são expostos ao navegador.
 */
import {
  onRequestPost as aiPost,
  onRequestOptions as aiOptions,
} from '../functions/api/ai';
import {
  onRequestPost as estimatePost,
  onRequestOptions as estimateOptions,
} from '../functions/api/ai/estimate';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
  GROQ_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  CRON_SECRET?: string;
}

const DEFAULT_SUPABASE_URL = 'https://kznwivlulavmtaiqleqe.supabase.co';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
};

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const withSecurityHeaders = (res: Response): Response => {
  const out = new Response(res.body, res);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    out.headers.set(key, value);
  }
  return out;
};

/**
 * Expira anúncios aprovados cujo `expires_at` já passou (mesma regra do `server.ts`).
 * Usa a REST API do Supabase diretamente para manter o bundle do Worker enxuto.
 */
async function expireAds(env: Env): Promise<number> {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no Worker.');

  const baseUrl = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const now = encodeURIComponent(new Date().toISOString());
  const url = `${baseUrl}/rest/v1/service_ads?status=eq.approved&expires_at=lt.${now}&select=id`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ status: 'expired' }),
  });

  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`);
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function handleExpireAds(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const provided = request.headers.get('x-cron-secret') || url.searchParams.get('secret');
  if (!provided) return json({ error: 'Não autorizado.' }, 401);
  if (!env.CRON_SECRET) return json({ error: 'CRON_SECRET não configurada no servidor.' }, 503);
  if (provided !== env.CRON_SECRET) return json({ error: 'Não autorizado.' }, 401);

  try {
    const count = await expireAds(env);
    return json({ ok: true, expired: count });
  } catch (e) {
    console.warn('expire-ads error:', e);
    return json({ error: 'Falha ao expirar anúncios.' }, 500);
  }
}

async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const method = request.method.toUpperCase();
  const route = pathname.replace(/\/+$/, '');

  if (route === '/api/ai') {
    if (method === 'OPTIONS') return aiOptions();
    if (method === 'POST') return aiPost({ request, env });
  } else if (route === '/api/ai/estimate') {
    if (method === 'OPTIONS') return estimateOptions();
    if (method === 'POST') return estimatePost({ request, env });
  } else if (route === '/api/expire-ads') {
    if (method === 'POST') return handleExpireAds(request, env);
  } else {
    return json({ error: 'Rota não encontrada.' }, 404);
  }

  return json({ error: 'Método não permitido.' }, 405);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/healthz') {
      return withSecurityHeaders(json({ ok: true }));
    }

    if (pathname.startsWith('/api/')) {
      return withSecurityHeaders(await handleApi(request, env, pathname));
    }

    return env.ASSETS.fetch(request);
  },
};
