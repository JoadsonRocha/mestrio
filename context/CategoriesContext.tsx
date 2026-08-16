import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { store } from '../services/store';
import { Category } from '../types';

/**
 * Opção simplificada de categoria para uso em selects/comboboxes.
 */
export interface CategoryOption {
  id: string;
  label: string;
}

/**
 * Estrutura do contexto de categorias.
 * Fornece acesso às categorias disponíveis e seus estados de carregamento.
 */
interface CategoriesContextValue {
  categories: Category[];
  options: CategoryOption[];
  loading: boolean;
  refreshCategories: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  options: [],
  loading: true,
  refreshCategories: async () => {},
});

/**
 * Provedor de Categorias.
 * Busca as categorias no banco e disponibiliza a lista para toda a aplicação.
 */
export const CategoriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await store.getCategories();
      setCategories(data.filter(c => c.active !== false));
    } catch (e) {
      console.warn('Erro ao carregar categorias (usando fallback offline):', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  const options = useMemo<CategoryOption[]>(() => [
    { id: 'all', label: 'Todos' },
    ...categories.map(c => ({ id: c.slug, label: c.name })),
  ], [categories]);

  const value = useMemo(() => ({
    categories,
    options,
    loading,
    refreshCategories,
  }), [categories, options, loading, refreshCategories]);

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
};

/**
 * Hook customizado para acessar rapidamente as categorias disponíveis.
 * Utilizado por componentes de busca e criação de anúncios.
 */
export const useCategories = () => useContext(CategoriesContext);