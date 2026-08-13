import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { store } from '../services/store';
import { Category } from '../types';

export interface CategoryOption {
  id: string;
  label: string;
}

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

export const CategoriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await store.getCategories();
      setCategories(data.filter(c => c.active !== false));
    } catch (e) {
      console.error('Erro ao carregar categorias:', e);
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

export const useCategories = () => useContext(CategoriesContext);