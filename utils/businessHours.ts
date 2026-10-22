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

export const DAY_MAP: Record<number, string> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
};

export const WEEK_DAYS_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export const DAY_NAMES: Record<string, string> = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo',
};

const DAY_ALIASES: Record<string, string> = {
  'seg': 'seg', 'segunda': 'seg', 'segunda-feira': 'seg', 'mon': 'seg', 'monday': 'seg',
  'ter': 'ter', 'terça': 'ter', 'terca': 'ter', 'terça-feira': 'ter', 'terca-feira': 'ter', 'tue': 'ter', 'tuesday': 'ter',
  'qua': 'qua', 'quarta': 'qua', 'quarta-feira': 'qua', 'wed': 'qua', 'wednesday': 'qua',
  'qui': 'qui', 'quinta': 'qui', 'quinta-feira': 'qui', 'thu': 'qui', 'thursday': 'qui',
  'sex': 'sex', 'sexta': 'sex', 'sexta-feira': 'sex', 'fri': 'sex', 'friday': 'sex',
  'sab': 'sab', 'sáb': 'sab', 'sábado': 'sab', 'sabado': 'sab', 'sat': 'sab', 'saturday': 'sab',
  'dom': 'dom', 'domingo': 'dom', 'sun': 'dom', 'sunday': 'dom',
};

export interface ScheduleBlock {
  days: string[];
  startMinutes: number;
  endMinutes: number;
  startStr: string;
  endStr: string;
}

/**
 * Normaliza um texto de dia para a chave canônica (seg, ter, qua, qui, sex, sab, dom)
 */
function normalizeDayToken(raw: string): string | null {
  const clean = raw
    .toLowerCase()
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/ç/g, 'c')
    .trim();

  return DAY_ALIASES[clean] || null;
}

/**
 * Expande intervalos como "seg a sex", "segunda a sexta", "seg - sab"
 */
function expandDayRange(startDay: string, endDay: string): string[] {
  const startIdx = WEEK_DAYS_ORDER.indexOf(startDay);
  const endIdx = WEEK_DAYS_ORDER.indexOf(endDay);
  if (startIdx === -1 || endIdx === -1) return [startDay, endDay];

  if (startIdx <= endIdx) {
    return WEEK_DAYS_ORDER.slice(startIdx, endIdx + 1);
  } else {
    // Ex: sab a ter (passando pelo domingo)
    return [...WEEK_DAYS_ORDER.slice(startIdx), ...WEEK_DAYS_ORDER.slice(0, endIdx + 1)];
  }
}

/**
 * Extrai todos os dias mencionados em uma string, reconhecendo listas e intervalos ("a", "à", "ate", "até", "-").
 */
export function extractDaysFromString(dayText: string): string[] {
  const clean = dayText.toLowerCase().trim();
  if (!clean) return [];

  // Casos especiais globais
  if (clean.includes('todos os dias') || clean.includes('diariamente') || clean.includes('segunda a domingo') || clean.includes('seg a dom')) {
    return ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  }
  if (clean.includes('segunda a sexta') || clean.includes('seg a sex') || clean.includes('segunda à sexta') || clean.includes('seg à sex') || clean.includes('seg-sex')) {
    const base = ['seg', 'ter', 'qua', 'qui', 'sex'];
    if (clean.includes('sab') || clean.includes('sáb') || clean.includes('sábado')) {
      base.push('sab');
    }
    if (clean.includes('dom') || clean.includes('domingo')) {
      base.push('dom');
    }
    return Array.from(new Set(base));
  }
  if (clean.includes('segunda a sabado') || clean.includes('seg a sab') || clean.includes('segunda à sábado') || clean.includes('seg à sáb') || clean.includes('seg-sab')) {
    return ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  }

  // Verifica padrão de intervalo tipo "X a Y" ou "X à Y" ou "X ate Y" ou "X - Y"
  const rangeMatch = clean.match(/([a-zà-ÿ]+)\s*(?:a|à|ate|até|-)\s*([a-zà-ÿ]+)/i);
  if (rangeMatch) {
    const d1 = normalizeDayToken(rangeMatch[1]);
    const d2 = normalizeDayToken(rangeMatch[2]);
    if (d1 && d2) {
      const expanded = expandDayRange(d1, d2);
      // Pega eventuais outros dias soltos (ex: "seg a sex, sab")
      const remainder = clean.replace(rangeMatch[0], '');
      const otherSegments = remainder.split(/[,;:/e\s-]+/).filter(Boolean);
      for (const seg of otherSegments) {
        const d = normalizeDayToken(seg);
        if (d && !expanded.includes(d)) expanded.push(d);
      }
      return expanded;
    }
  }

  // Se não for intervalo, separa por vírgulas, espaços, barras, etc.
  const rawSegments = clean.split(/[,;:/e\s-]+/).filter(Boolean);
  const days: string[] = [];

  for (const raw of rawSegments) {
    const canonical = normalizeDayToken(raw);
    if (canonical && !days.includes(canonical)) {
      days.push(canonical);
    }
  }

  return days;
}

/**
 * Normaliza e extrai dias e horários de uma string de disponibilidade.
 */
export function parseAvailabilityString(availability?: string): ScheduleBlock | null {
  if (!availability) return null;

  const clean = availability.trim();

  // Procura padrão de horário tipo 08:00 - 18:00 ou 08h às 18h ou 8:00 às 18:00 ou 08:00 as 18:00
  const timeMatch = clean.match(/(\d{1,2})[:h]?(\d{2})?\s*[-àa]\s*(\d{1,2})[:h]?(\d{2})?/i);
  if (!timeMatch) {
    // Se não tem horário explícito mas cita dias ou comercial
    if (clean.toLowerCase().includes('comercial') || clean.toLowerCase().includes('seg')) {
      const days = extractDaysFromString(clean);
      return {
        days: days.length > 0 ? days : ['seg', 'ter', 'qua', 'qui', 'sex'],
        startMinutes: 8 * 60,
        endMinutes: 18 * 60,
        startStr: '08:00',
        endStr: '18:00',
      };
    }
    return null;
  }

  const startHour = parseInt(timeMatch[1], 10);
  const startMin = parseInt(timeMatch[2] || '0', 10);
  const endHour = parseInt(timeMatch[3], 10);
  const endMin = parseInt(timeMatch[4] || '0', 10);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const startStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  const dayPart = clean.replace(timeMatch[0], '');
  const days = extractDaysFromString(dayPart);

  return { days, startMinutes, endMinutes, startStr, endStr };
}

/**
 * Normaliza e extrai blocos de dias e horários de uma string de disponibilidade.
 * Suporta múltiplos blocos diários (ex: "Seg: 08:00 - 18:00, Sáb: 08:00 - 12:00")
 */
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

  const lower = availability.toLowerCase().trim();

  // 1. Sempre Aberto / 24 Horas
  if (lower.includes('24h') || lower.includes('24 horas') || lower.includes('24 horas (atendimento contínuo)') || lower.includes('sempre')) {
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

