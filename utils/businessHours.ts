/**
 * Utilitário para cálculo de horário de atendimento em tempo real ("Atendendo Agora").
 * Inspirado no padrão da indústria de diretórios (Directorist / Google Business).
 */

export interface BusinessStatus {
  isOpen: boolean;
  statusText: string;
  badgeVariant: 'open' | 'closed' | 'always_open' | 'unavailable';
  shortBadge: string;
  colorClass: string;
  dotColorClass: string;
}

const DAY_MAP: Record<number, string> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
};

const DAY_ALIASES: Record<string, string> = {
  'seg': 'seg', 'segunda': 'seg', 'segunda-feira': 'seg', 'mon': 'seg',
  'ter': 'ter', 'terça': 'ter', 'terca': 'ter', 'terça-feira': 'ter', 'tue': 'ter',
  'qua': 'qua', 'quarta': 'qua', 'quarta-feira': 'qua', 'wed': 'qua',
  'qui': 'qui', 'quinta': 'qui', 'quinta-feira': 'qui', 'thu': 'qui',
  'sex': 'sex', 'sexta': 'sex', 'sexta-feira': 'sex', 'fri': 'sex',
  'sab': 'sab', 'sáb': 'sab', 'sábado': 'sab', 'sabado': 'sab', 'sat': 'sab',
  'dom': 'dom', 'domingo': 'dom', 'sun': 'dom',
};

/**
 * Normaliza e extrai blocos de dias e horários de uma string de disponibilidade.
 * Suporta formatos:
 * 1) "Seg, Ter, Qua, 08:00 - 18:00"
 * 2) "Seg: 08:00 - 18:00, Ter: 08:00 - 18:00, Sáb: 08:00 - 12:00"
 */
export interface ScheduleBlock {
  days: string[];
  startMinutes: number;
  endMinutes: number;
  startStr: string;
  endStr: string;
}

export function parseAllScheduleBlocks(availability?: string): ScheduleBlock[] {
  if (!availability) return [];
  const clean = availability.trim();

  // Verifica se tem formato com dois pontos para cada dia, ex: "Seg: 08:00 - 18:00"
  if (clean.includes(':') && (clean.includes('Seg:') || clean.includes('Ter:') || clean.includes('Qua:') || clean.includes('Qui:') || clean.includes('Sex:') || clean.includes('Sáb:') || clean.includes('Sab:') || clean.includes('Dom:'))) {
    const parts = clean.split(/,\s*(?=[A-Za-zÀ-ÿ]+:)/);
    const blocks: ScheduleBlock[] = [];

    for (const part of parts) {
      const sub = parseAvailabilityString(part);
      if (sub && sub.days.length > 0) {
        blocks.push(sub);
      }
    }
    if (blocks.length > 0) return blocks;
  }

  const single = parseAvailabilityString(clean);
  return single ? [single] : [];
}

/**
 * Normaliza e extrai dias e horários de uma string de disponibilidade.
 */
export function parseAvailabilityString(availability?: string): ScheduleBlock | null {
  if (!availability) return null;

  const clean = availability.trim();

  // Procura padrão de horário tipo 08:00 - 18:00 ou 08h às 18h ou 8:00 às 18:00
  const timeMatch = clean.match(/(\d{1,2})[:h]?(\d{2})?\s*[-àa]\s*(\d{1,2})[:h]?(\d{2})?/i);
  if (!timeMatch) return null;

  const startHour = parseInt(timeMatch[1], 10);
  const startMin = parseInt(timeMatch[2] || '0', 10);
  const endHour = parseInt(timeMatch[3], 10);
  const endMin = parseInt(timeMatch[4] || '0', 10);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const startStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  const dayPart = clean.replace(timeMatch[0], '').toLowerCase();
  const rawSegments = dayPart.split(/[,;:\/\-e\s]+/).filter(Boolean);

  const days: string[] = [];
  for (const raw of rawSegments) {
    const normalized = raw
      .replace(/[áàâã]/g, 'a')
      .replace(/[éèê]/g, 'e')
      .replace(/[íìî]/g, 'i')
      .replace(/[óòôõ]/g, 'o')
      .replace(/[úùû]/g, 'u')
      .replace(/ç/g, 'c');

    if (DAY_ALIASES[normalized]) {
      const canonical = DAY_ALIASES[normalized];
      if (!days.includes(canonical)) {
        days.push(canonical);
      }
    }
  }

  return { days, startMinutes, endMinutes, startStr, endStr };
}

/**
 * Determina se o anúncio/profissional está em horário de atendimento agora.
 */
export function getBusinessStatus(availability?: string, now = new Date()): BusinessStatus {
  if (!availability) {
    // Padrão comercial (Seg-Sex, 08h às 18h)
    const day = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isCommercialHours = currentMinutes >= 8 * 60 && currentMinutes < 18 * 60;

    if (isWeekday && isCommercialHours) {
      return {
        isOpen: true,
        statusText: 'Atendendo Agora (Horário Comercial)',
        badgeVariant: 'open',
        shortBadge: 'Atendendo Agora',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColorClass: 'bg-emerald-500 ring-emerald-300',
      };
    }

    return {
      isOpen: false,
      statusText: 'Fechado no momento (Abre às 08:00)',
      badgeVariant: 'closed',
      shortBadge: 'Fechado',
      colorClass: 'bg-gray-100 text-gray-600 border-gray-200',
      dotColorClass: 'bg-gray-400 ring-gray-200',
    };
  }

  const lower = availability.toLowerCase();

  // 1. Sempre Aberto / 24 Horas
  if (lower.includes('24h') || lower.includes('24 horas') || lower.includes('sempre')) {
    return {
      isOpen: true,
      statusText: 'Atendimento 24 Horas',
      badgeVariant: 'always_open',
      shortBadge: '24 Horas',
      colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotColorClass: 'bg-emerald-500 ring-emerald-300',
    };
  }

  // 2. Emergências
  if (lower.includes('emergencia') || lower.includes('emergência') || lower.includes('plantao') || lower.includes('plantão')) {
    return {
      isOpen: true,
      statusText: 'Plantão de Emergências',
      badgeVariant: 'always_open',
      shortBadge: 'Emergências',
      colorClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotColorClass: 'bg-rose-500 ring-rose-300',
    };
  }

  // 3. Parse estruturado de múltiplos blocos de dias e horários
  const blocks = parseAllScheduleBlocks(availability);
  if (blocks.length === 0) {
    return {
      isOpen: true,
      statusText: 'Disponível para contato',
      badgeVariant: 'open',
      shortBadge: 'Atendendo',
      colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotColorClass: 'bg-emerald-500 ring-emerald-300',
    };
  }

  const currentDayId = DAY_MAP[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Procura se hoje coincide com algum bloco
  const matchingBlock = blocks.find(b => b.days.length === 0 || b.days.includes(currentDayId));

  if (matchingBlock) {
    if (currentMinutes >= matchingBlock.startMinutes && currentMinutes <= matchingBlock.endMinutes) {
      return {
        isOpen: true,
        statusText: `Atendendo Agora (Até às ${matchingBlock.endStr})`,
        badgeVariant: 'open',
        shortBadge: 'Atendendo Agora',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColorClass: 'bg-emerald-500 ring-emerald-300',
      };
    }

    if (currentMinutes < matchingBlock.startMinutes) {
      return {
        isOpen: false,
        statusText: `Abre hoje às ${matchingBlock.startStr}`,
        badgeVariant: 'closed',
        shortBadge: `Abre às ${matchingBlock.startStr}`,
        colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotColorClass: 'bg-amber-400 ring-amber-200',
      };
    }

    return {
      isOpen: false,
      statusText: `Fechado no momento (Encerrou às ${matchingBlock.endStr})`,
      badgeVariant: 'closed',
      shortBadge: 'Fechado',
      colorClass: 'bg-gray-100 text-gray-600 border-gray-200',
      dotColorClass: 'bg-gray-400 ring-gray-200',
    };
  }

  return {
    isOpen: false,
    statusText: 'Fechado hoje',
    badgeVariant: 'closed',
    shortBadge: 'Fechado hoje',
    colorClass: 'bg-gray-100 text-gray-600 border-gray-200',
    dotColorClass: 'bg-gray-400 ring-gray-200',
  };
}
