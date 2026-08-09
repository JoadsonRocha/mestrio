const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_REGEX = /<script|javascript:|on\w+=/i;

export function sanitizeText(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(HTML_TAG_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeHtmlLike(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(SCRIPT_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .trim();
}

export function sanitizePhone(value: string): string {
  return String(value).replace(/\D/g, '').slice(0, 15);
}
