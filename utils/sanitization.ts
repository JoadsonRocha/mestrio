const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_REGEX = /<script|javascript:|on\w+=/i;
const PHONE_PATTERN_REGEX = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s\.]?\d{4}/gi;

/**
 * Mascara e oculta automaticamente telefones e números de contato escritos em descrições públicas.
 */
export function maskPhoneNumbers(text: string): string {
  if (!text) return '';
  return String(text).replace(PHONE_PATTERN_REGEX, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 13) {
      return '[número ocultado]';
    }
    return match;
  });
}

export function sanitizeText(value: string): string {
  if (!value) return '';
  const cleaned = String(value)
    .replace(HTML_TAG_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
  return maskPhoneNumbers(cleaned);
}

export function sanitizeHtmlLike(value: string): string {
  if (!value) return '';
  const cleaned = String(value)
    .replace(SCRIPT_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .trim();
  return maskPhoneNumbers(cleaned);
}

export function sanitizePhone(value: string): string {
  return String(value).replace(/\D/g, '').slice(0, 15);
}
