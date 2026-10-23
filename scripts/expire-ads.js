// Script do Cron do Railway: expira anúncios aprovados com expires_at no passado.
// Usado por um serviço separado no Railway (Start: node scripts/expire-ads.js,
// Cron Schedule: 0 6 * * *). Requer SUPABASE_SERVICE_ROLE_KEY. Encerra sozinho.
import { createClient } from '@supabase/supabase-js';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL || 'https://kznwivlulavmtaiqleqe.supabase.co';
const supabase = createClient(url, serviceKey);

const now = new Date().toISOString();
const { data, error } = await supabase
  .from('service_ads')
  .update({ status: 'expired' })
  .eq('status', 'approved')
  .lt('expires_at', now)
  .select('id');

if (error) {
  console.error('Falha ao expirar anúncios:', error.message);
  process.exit(1);
}

console.log(`Expired ${(data || []).length} ads.`);
process.exit(0);
