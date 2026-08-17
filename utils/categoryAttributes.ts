/**
 * Definição de Atributos e Campos Dinâmicos por Categoria (Padrão Directorist)
 * Permite que cada especialidade tenha perguntas e diferenciais técnicos específicos.
 */

export interface CategoryAttribute {
  id: string;
  label: string;
  description: string;
  type: 'boolean' | 'text';
  iconName?: string;
}

export const CATEGORY_CUSTOM_ATTRIBUTES: Record<string, CategoryAttribute[]> = {
  'eletricista': [
    { id: 'has_nr10', label: 'Possui Certificação NR10', description: 'Trabalho em instalações e serviços em eletricidade com segurança', type: 'boolean' },
    { id: 'handles_three_phase', label: 'Atende Rede Trifásica & Padrão de Entrada', description: 'Instalação e adequação de padrões de concessionária', type: 'boolean' },
    { id: 'provides_art', label: 'Emite Laudo / ART de Engenharia', description: 'Documentação técnica para condomínios e estabelecimentos', type: 'boolean' },
    { id: 'emergency_24h', label: 'Plantão para Quedas de Energia & Curtos', description: 'Atendimento prioritário em emergências', type: 'boolean' },
  ],
  'ar-condicionado': [
    { id: 'emits_pmoc', label: 'Emite Laudo Técnico PMOC', description: 'Plano de Manutenção, Operação e Controle para empresas', type: 'boolean' },
    { id: 'chemical_cleaning', label: 'Higienização Química Antibacteriana', description: 'Limpeza profunda com produtos homologados pela Anvisa', type: 'boolean' },
    { id: 'inverter_specialist', label: 'Especialista em Sistemas Inverter & Multi-Split', description: 'Instalação com bomba de vácuo e teste de estanqueidade', type: 'boolean' },
    { id: 'provides_warranty', label: 'Garantia de Instalação (mínimo 6 meses)', description: 'Segurança contra vazamentos de gás e drenagem', type: 'boolean' },
  ],
  'encanador': [
    { id: 'geophone_leak_detector', label: 'Detecção Eletrônica de Vazamento (Geofone)', description: 'Localiza vazamentos ocultos sem quebrar paredes desnecessariamente', type: 'boolean' },
    { id: 'pipe_unclogging_machine', label: 'Desentupimento com Máquina Rotativa K50/K500', description: 'Desobstrução rápida de pias, ralos e esgotos', type: 'boolean' },
    { id: 'pressure_pump_repair', label: 'Instalação e Reparo de Pressurizadores', description: 'Aumento de pressão em chuveiros e torneiras', type: 'boolean' },
  ],
  'pintura': [
    { id: 'airless_sprayer', label: 'Pintura Mecanizada Airless', description: 'Maior rapidez e acabamento uniforme sem marcas de rolo', type: 'boolean' },
    { id: 'moisture_treatment', label: 'Tratamento de Infiltração e Mofo', description: 'Aplicação de impermeabilizantes e seladores antes da pintura', type: 'boolean' },
    { id: 'decorative_finishes', label: 'Efeitos Especiais (Cimento Queimado, Marmorato)', description: 'Aplicação de texturas decorativas de alto padrão', type: 'boolean' },
    { id: 'floor_protection', label: 'Proteção Completa de Pisos e Móveis com Lona', description: 'Entrega do ambiente limpo e organizado', type: 'boolean' },
  ],
  'limpeza': [
    { id: 'own_supplies', label: 'Leva Produtos e Materiais Próprios', description: 'Aspirador, panos de microfibra, baldes e químicos inclusos', type: 'boolean' },
    { id: 'post_construction', label: 'Especialista em Limpeza Pós-Obra', description: 'Remoção pesada de resíduos de gesso, tinta e cimento', type: 'boolean' },
    { id: 'clothes_ironing', label: 'Serviço de Passadoria de Roupas', description: 'Passar e organizar roupas no cabide/gaveta', type: 'boolean' },
  ],
  'pedreiro': [
    { id: 'porcelain_tile_pro', label: 'Assentamento de Porcelanatos Grandes Formatos', description: 'Cortes em 45 graus (meia-esquadria) e nivelamento a laser', type: 'boolean' },
    { id: 'drywall_gypsum', label: 'Instalação de Drywall e Forros de Gesso', description: 'Divisórias acústicas e rebaixamento com iluminação embutida', type: 'boolean' },
    { id: 'waterproofing', label: 'Impermeabilização de Lajes, Banheiros e Baldrames', description: 'Prevenção e cura definitiva contra umidade', type: 'boolean' },
  ],
  'marcenaria': [
    { id: 'custom_mdf', label: 'Móveis Sob Medida 100% MDF', description: 'Projetos personalizados com ferragens amortecidas', type: 'boolean' },
    { id: 'furniture_assembly', label: 'Montagem e Desmontagem Especializada', description: 'Montagem profissional de móveis comprados online', type: 'boolean' },
    { id: 'furniture_restoration', label: 'Restauração e Laqueação de Madeira Maciça', description: 'Renovação de móveis antigos e troca de puxadores', type: 'boolean' },
  ],
};

/**
 * Retorna os atributos específicos para a categoria fornecida (ou lista vazia se não houver).
 */
export function getCategoryAttributes(categorySlugOrName?: string): CategoryAttribute[] {
  if (!categorySlugOrName) return [];
  const normalized = categorySlugOrName.toLowerCase().trim()
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/ç/g, 'c');

  for (const [key, attrs] of Object.entries(CATEGORY_CUSTOM_ATTRIBUTES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return attrs;
    }
  }

  // Atributos genéricos de qualidade para qualquer serviço
  return [
    { id: 'provides_warranty', label: 'Oferece Garantia do Serviço', description: 'Garantia técnica contra defeitos de execução', type: 'boolean' },
    { id: 'emergency_ready', label: 'Atendimento Rápido / Mesmo Dia', description: 'Disponibilidade para atendimentos imediatos', type: 'boolean' },
    { id: 'emits_invoice', label: 'Emite Nota Fiscal (MEI / ME)', description: 'Comprovante fiscal para empresas e residências', type: 'boolean' },
  ];
}
