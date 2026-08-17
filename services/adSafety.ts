/**
 * Módulo de Detecção e Moderação de Segurança para Anúncios no Mestrio.
 * - Detecta termos proibidos e conteúdo sexual explícito / prostituição / acompanhantes.
 * - Detecta gatilhos de fraudes, golpes financeiros, pirâmides, empréstimos ilegais.
 * - Detecta discrepâncias de preço irreal / iscas de clique.
 * - Detecta tentativa de mascaramento de contato ou links maliciosos.
 * - Fornece pontuação de risco (Risk Score de 0 a 100) e alertas detalhados para o Dono/Administrador.
 */

export interface AdSafetyAnalysis {
  riskScore: number; // 0 a 100
  isCriticalBlocked: boolean; // Bloqueio imediato do formulário
  flags: string[]; // Lista de alertas específicos
  categoriesDetected: ('sexual_content' | 'financial_fraud' | 'unrealistic_price' | 'suspicious_contact' | 'low_quality')[];
  recommendation: 'auto_approve' | 'manual_review' | 'auto_reject';
  userMessage?: string; // Mensagem amigável para o anunciante corrigir
}

// 1. Termos de Conteúdo Sexual / Adulto / Prostituição / Serviços Íntimos (Bloqueio Crítico)
const ADULT_SEXUAL_KEYWORDS = [
  'acompanhante', 'acompanhantes', 'massagem erotica', 'massagem sensual', 'massagista sensual',
  'massagem relaxante com finalizacao', 'com finalizacao', 'com final', 'oral', 'sigilo absoluto',
  'garoto de programa', 'garota de programa', 'novinha', 'safada', 'travesti ativo', 'travesti passivo',
  'gp', 'encontro intimo', 'prazer', 'ninfeta', 'sem frescura', 'com local e sigilo',
  'massagem tantrica com sexo', 'boquete', 'sexo oral', 'fetiche', 'dominacao', 'sugar daddy',
  'sugar baby', 'pack de fotos', 'nude', 'nudes', 'venda de conteudo adulto', 'onlyfans'
];

// 2. Termos de Fraude Financeira, Golpes, Pirâmides e Renda Fácil
const FRAUD_KEYWORDS = [
  'dinheiro facil', 'ganhe dinheiro dormindo', 'renda extra garantida', 'lucro de 100%',
  'trabalhe em casa digitando', 'aposta garantida', 'robo do pix', 'pix premiado', 'multiplicador de pix',
  'hack do aviator', 'bug do pix', 'esquema financeiro', 'investimento sem risco', 'dobro do valor',
  'limpeza de nome spc serasa sem pagar', 'cnh facilitada', 'venda de diploma', 'comprovante de renda falso',
  'venda de notas falsas', 'cartao clonado', 'infocc', 'cc clonada'
];

// 3. Padrões de Mascaramento de Telefone ou Chave Pix em Texto
const OBFUSCATED_PHONE_REGEX = /(?:zap|whatsapp|chama no|fone|contato)[\s:]*(?:nove|oito|sete|zero|um|dois|tres|quatro|cinco|meia|\d[\s.-]*\d[\s.-]*\d[\s.-]*\d)/i;
const SUSPICIOUS_EXTERNAL_LINKS = /(?:bit\.ly|t\.me|wa\.me|tinyurl\.com|cutt\.ly|is\.gd)/i;

/**
 * Normaliza o texto removendo acentos e convertendo para minúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ');
}

/**
 * Analisa um anúncio (na criação, edição ou moderação administrativa)
 */
export function analyzeAdSafety(data: {
  title: string;
  description: string;
  category?: string;
  price?: number;
  priceUnit?: 'hour' | 'job' | 'estimate';
  tags?: string[];
}): AdSafetyAnalysis {
  const flags: string[] = [];
  const categoriesDetected: AdSafetyAnalysis['categoriesDetected'] = [];
  let riskScore = 0;
  let isCriticalBlocked = false;
  let userMessage = '';

  const fullRawText = `${data.title} ${data.description} ${(data.tags || []).join(' ')}`;
  const normalized = normalizeText(fullRawText);

  // A. Verificação de Conteúdo Adulto / Sexual (Tolerância Zero)
  for (const kw of ADULT_SEXUAL_KEYWORDS) {
    const normKw = normalizeText(kw);
    if (normalized.includes(normKw)) {
      flags.push(`Conteúdo ou serviço sexual explícito detectado: "${kw}"`);
      if (!categoriesDetected.includes('sexual_content')) categoriesDetected.push('sexual_content');
      riskScore += 90;
      isCriticalBlocked = true;
      userMessage = 'O Mestrio é uma plataforma exclusiva para serviços profissionais gerais (reparos, manutenções, limpeza, etc). Anúncios de cunho adulto ou íntimo são estritamente proibidos pelos nossos Termos de Uso.';
      break;
    }
  }

  // B. Verificação de Fraude Financeira e Golpes
  for (const kw of FRAUD_KEYWORDS) {
    const normKw = normalizeText(kw);
    if (normalized.includes(normKw)) {
      flags.push(`Gatilho de fraude financeira / promessa de renda fácil: "${kw}"`);
      if (!categoriesDetected.includes('financial_fraud')) categoriesDetected.push('financial_fraud');
      riskScore += 75;
      isCriticalBlocked = true;
      userMessage = 'Identificamos promessas de ganhos financeiros ou termos associados a fraudes. Revise o conteúdo do seu anúncio.';
      break;
    }
  }

  // C. Verificação de Contato Oculto / Links Externos Suspeitos
  if (OBFUSCATED_PHONE_REGEX.test(fullRawText)) {
    flags.push('Tentativa de inserção de telefone por extenso no texto da descrição');
    if (!categoriesDetected.includes('suspicious_contact')) categoriesDetected.push('suspicious_contact');
    riskScore += 25;
  }

  if (SUSPICIOUS_EXTERNAL_LINKS.test(fullRawText)) {
    flags.push('Links encurtados ou externos não autorizados no anúncio');
    if (!categoriesDetected.includes('suspicious_contact')) categoriesDetected.push('suspicious_contact');
    riskScore += 35;
  }

  // D. Verificação de Preço Irreal / Isca
  const price = data.price || 0;
  const isEstimate = data.priceUnit === 'estimate';

  if (!isEstimate && price > 0 && price < 15) {
    flags.push(`Preço muito baixo (R$ ${price.toFixed(2)}), possível valor isca ou irreal`);
    if (!categoriesDetected.includes('unrealistic_price')) categoriesDetected.push('unrealistic_price');
    riskScore += 20;
  } else if (!isEstimate && price > 50000) {
    flags.push(`Preço atipicamente elevado (R$ ${price.toFixed(2)}), necessita confirmação`);
    if (!categoriesDetected.includes('unrealistic_price')) categoriesDetected.push('unrealistic_price');
    riskScore += 15;
  }

  // E. Qualidade Geral e Consistência
  if (data.description.trim().length < 20) {
    flags.push('Descrição muito curta ou vaga');
    if (!categoriesDetected.includes('low_quality')) categoriesDetected.push('low_quality');
    riskScore += 10;
  }

  // Cap do Score de Risco (0 a 100)
  riskScore = Math.min(100, Math.max(0, riskScore));

  let recommendation: AdSafetyAnalysis['recommendation'] = 'auto_approve';
  if (isCriticalBlocked || riskScore >= 70) {
    recommendation = 'auto_reject';
  } else if (riskScore >= 25) {
    recommendation = 'manual_review';
  }

  return {
    riskScore,
    isCriticalBlocked,
    flags,
    categoriesDetected,
    recommendation,
    userMessage: isCriticalBlocked ? userMessage : undefined
  };
}
