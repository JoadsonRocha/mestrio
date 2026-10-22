// Expressões regulares para detecção e limpeza de tags HTML, injeções de script e números de telefone
const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_REGEX = /<script|javascript:|on\w+=/i;

// Regex para mapeamento e detecção flexível de números de celular e telefone fixo no Brasil (com ou sem DDD/DDI)
const PHONE_PATTERN_REGEX = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s.]?\d{4}/gi;

/**
 * Mascara e oculta automaticamente telefones e números de contato escritos em descrições públicas.
 * Isso ajuda a evitar que contatos comerciais e acordos ocorram fora da plataforma, protegendo os usuários e a receita futura.
 */
export function maskPhoneNumbers(text: string): string {
  if (!text) return '';
  return String(text).replace(PHONE_PATTERN_REGEX, (match) => {
    const digits = match.replace(/\D/g, '');
    // Se o número de dígitos limpos for compatível com um telefone válido no Brasil
    if (digits.length >= 8 && digits.length <= 13) {
      return '[número ocultado]';
    }
    return match;
  });
}

/**
 * Limpa o texto inserido pelo usuário removendo quaisquer tags HTML,
 * normalizando espaços e prevenindo injeções de código.
 */
export function sanitizeText(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(HTML_TAG_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove scripts maliciosos e injeções inline em atributos HTML (XSS preventivo)
 * enquanto mantém o texto legível.
 */
export function sanitizeHtmlLike(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(SCRIPT_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .trim();
}

/**
 * Sanitiza e formata strings de telefone, preservando apenas os dígitos numéricos
 * até um limite máximo de 15 caracteres (padrão internacional E.164).
 */
export function sanitizePhone(value: string): string {
  return String(value).replace(/\D/g, '').slice(0, 15);
}

/**
 * Sanitiza e valida URLs externas (redes sociais, sites de portfólio, links de imagens).
 * Bloqueia protocolos perigosos como javascript:, data: ou vbscript:, prevenindo Stored XSS.
 */
export function sanitizeUrl(value: string): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  
  // Rejeita esquemas maliciosos
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
    return '';
  }

  // Se for uma URL sem protocolo relativo mas com domínio (ex: instagram.com/user)
  if (!/^https?:\/\//i.test(trimmed) && !/^(mailto:|tel:)/i.test(trimmed)) {
    if (trimmed.startsWith('/') || trimmed.startsWith('.')) {
      return ''; // Não permite caminhos relativos arbitrários em links externos
    }
    return `https://${trimmed}`;
  }

  return trimmed;
}


