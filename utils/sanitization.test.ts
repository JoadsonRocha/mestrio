import { describe, it, expect } from 'vitest';
import { sanitizeText, maskPhoneNumbers, sanitizePhone, sanitizeUrl } from './sanitization';

describe('sanitization utils', () => {
  it('strips dangerous HTML tags from text without corrupting CEPs or order numbers', () => {
    const input = '<b>Avenida Paulista, 1000</b> - CEP 01310-100, São Paulo';
    const result = sanitizeText(input);
    expect(result).toBe('Avenida Paulista, 1000 - CEP 01310-100, São Paulo');
  });

  it('preserves invoice/quote reference numbers in sanitizeText', () => {
    const input = 'Orçamento ORC-2026-9481 para reforma';
    const result = sanitizeText(input);
    expect(result).toBe('Orçamento ORC-2026-9481 para reforma');
  });

  it('correctly masks explicit phone numbers in maskPhoneNumbers', () => {
    const input = 'Fale comigo no (11) 98765-4321 para agendar.';
    const result = maskPhoneNumbers(input);
    expect(result).toContain('[número ocultado]');
    expect(result).not.toContain('98765-4321');
  });

  it('sanitizes telephone strings to digits only', () => {
    expect(sanitizePhone('+55 (11) 98765-4321')).toBe('5511987654321');
  });

  it('blocks dangerous javascript: and data: schemes in sanitizeUrl', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('https://instagram.com/prestador')).toBe('https://instagram.com/prestador');
  });
});
