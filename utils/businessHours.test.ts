import { describe, it, expect } from 'vitest';
import { getBusinessStatus } from './businessHours';

describe('businessHours utils', () => {
  it('returns always_open badge for 24 horas availability', () => {
    const status = getBusinessStatus('24 Horas (Atendimento Contínuo)');
    expect(status.isOpen).toBe(true);
    expect(status.badgeVariant).toBe('always_open');
    expect(status.shortBadge).toBe('24 Horas');
  });

  it('returns always_open badge for Plantão / Emergências', () => {
    const status = getBusinessStatus('Plantão de emergência aos finais de semana');
    expect(status.isOpen).toBe(true);
    expect(status.badgeVariant).toBe('always_open');
    expect(status.shortBadge).toBe('Emergências');
  });

  it('evaluates commercial weekday hours correctly when no string is provided', () => {
    // Quarta-feira, 14:30
    const wednesdayAfternoon = new Date('2026-10-21T14:30:00');
    const openStatus = getBusinessStatus(undefined, wednesdayAfternoon);
    expect(openStatus.isOpen).toBe(true);
    expect(openStatus.badgeVariant).toBe('open');

    // Domingo, 14:30
    const sundayAfternoon = new Date('2026-10-25T14:30:00');
    const closedStatus = getBusinessStatus(undefined, sundayAfternoon);
    expect(closedStatus.isOpen).toBe(false);
    expect(closedStatus.badgeVariant).toBe('closed');
  });

  it('parses structured schedule blocks and respects opening hours', () => {
    const schedule = 'Seg a Sex das 09:00 às 17:00';
    
    // Terça-feira às 10:00 -> Aberto
    const tuesdayMorning = new Date('2026-10-20T10:00:00');
    const openStatus = getBusinessStatus(schedule, tuesdayMorning);
    expect(openStatus.isOpen).toBe(true);
    expect(openStatus.statusText).toContain('Atendendo Agora');

    // Terça-feira às 18:00 -> Fechado
    const tuesdayEvening = new Date('2026-10-20T18:00:00');
    const closedStatus = getBusinessStatus(schedule, tuesdayEvening);
    expect(closedStatus.isOpen).toBe(false);
    expect(closedStatus.statusText).toContain('Fechado no momento');
  });
});
