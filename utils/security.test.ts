import { describe, it, expect } from 'vitest';
import { validatePassword, validateEmail } from './security';

describe('security utils', () => {
  describe('validatePassword', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const res = validatePassword('Ab1!');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('mínimo 8 caracteres');
    });

    it('rejects passwords without uppercase letters', () => {
      const res = validatePassword('senhafraca123!@#');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('letra maiúscula');
    });

    it('rejects passwords without numbers', () => {
      const res = validatePassword('SenhaSemNumero!@#');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('número');
    });

    it('rejects passwords without special characters', () => {
      const res = validatePassword('Senha12345678');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('caractere especial');
    });

    it('rejects repeated sequence characters', () => {
      const res = validatePassword('Ssssenha@123');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('repetido em sequência');
    });

    it('rejects trivial patterns like qwerty or 12345', () => {
      const res = validatePassword('Qwerty@123456');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('sequências fáceis');
    });

    it('accepts strong, compliant passwords', () => {
      const res = validatePassword('Mestr!o#Prof2026');
      expect(res.valid).toBe(true);
      expect(res.message).toBeUndefined();
    });
  });

  describe('validateEmail', () => {
    it('rejects empty or whitespace-only emails', () => {
      expect(validateEmail('').valid).toBe(false);
      expect(validateEmail('   ').valid).toBe(false);
    });

    it('rejects malformed email formats', () => {
      expect(validateEmail('usuario@').valid).toBe(false);
      expect(validateEmail('usuario@dominio').valid).toBe(false);
      expect(validateEmail('@dominio.com').valid).toBe(false);
    });

    it('accepts valid email addresses', () => {
      expect(validateEmail('contato@mestrio.app').valid).toBe(true);
      expect(validateEmail('prestador.reforma@gmail.com').valid).toBe(true);
    });
  });
});
