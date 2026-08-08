export interface DefaultCategory {
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
}

// Fallback usado quando o banco (tabela categories) ainda não tem dados.
// O admin pode gerenciar essas categorias pelo painel /owner.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { slug: 'electrician', name: 'Eletricista', icon: 'Zap', sortOrder: 1 },
  { slug: 'plumber', name: 'Encanador', icon: 'Droplets', sortOrder: 2 },
  { slug: 'painter', name: 'Pintor', icon: 'Paintbrush', sortOrder: 3 },
  { slug: 'cleaning', name: 'Faxina', icon: 'Brush', sortOrder: 4 },
  { slug: 'handyman', name: 'Marido de Aluguel', icon: 'Wrench', sortOrder: 5 },
  { slug: 'moving', name: 'Mudanças', icon: 'Truck', sortOrder: 6 },
  { slug: 'gardener', name: 'Jardineiro', icon: 'Leaf', sortOrder: 7 },
  { slug: 'assembly', name: 'Montagem de Móveis', icon: 'Package', sortOrder: 8 },
];

// Ícones disponíveis para escolha ao cadastrar/editar uma categoria
export const CATEGORY_ICON_OPTIONS: string[] = [
  'Zap', 'Droplets', 'Paintbrush', 'Brush', 'Wrench', 'Truck', 'Leaf', 'Package',
  'Hammer', 'Cog', 'Plug', 'Drill', 'Sparkles', 'Scissors', 'Sofa', 'Laptop',
  'Bike', 'KeyRound', 'Wifi', 'ShowerHead',
];
