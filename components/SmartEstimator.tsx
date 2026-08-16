import React, { useState } from 'react';
import { Bot, Loader2, Search, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

/**
 * Estrutura da resposta fornecida pela IA para uma estimativa.
 */
interface EstimateResponse {
  category: string;
  possible_issue: string;
  price_range: string;
}

/**
 * Componente "Orçador Inteligente".
 * Um widget flutuante no canto inferior que permite ao usuário relatar um problema
 * para que a IA sugira uma categoria e um preço médio estimado.
 */
export const SmartEstimator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem }),
      });

      if (!res.ok) throw new Error('Falha na requisição');

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      toast('Não foi possível gerar a estimativa. Tente novamente mais tarde.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (result && result.category) {
      navigate(`/categoria/${result.category.toLowerCase()}`);
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 z-50 group"
      >
        <Bot size={28} className="group-hover:animate-bounce" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:ml-3 font-semibold">
          Orçador Inteligente
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-brand-100 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-brand-600 p-4 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <h3 className="font-bold">Orçador Inteligente (IA)</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-5 flex-1 overflow-y-auto max-h-96">
        {!result ? (
          <form onSubmit={handleEstimate} className="space-y-4">
            <p className="text-sm text-gray-600">
              Descreva o que quebrou ou o que você precisa. Nossa Inteligência Artificial vai analisar o problema, descobrir qual profissional você precisa e estimar um preço médio.
            </p>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Ex: Minha geladeira parou de gelar a parte de baixo de repente..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !problem.trim()}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 font-bold flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Analisar Problema'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h4 className="text-sm font-bold text-blue-800 uppercase mb-1">Problema Identificado</h4>
              <p className="text-gray-700 text-sm">{result.possible_issue}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Categoria</span>
                <span className="text-gray-900 font-semibold">{result.category}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Preço Médio</span>
                <span className="text-green-600 font-bold">{result.price_range}</span>
              </div>
            </div>

            <button
              onClick={handleSearch}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 font-bold flex items-center justify-center transition-colors mt-4"
            >
              Buscar Profissionais <ArrowRight size={18} className="ml-2" />
            </button>
            <button
              onClick={() => { setResult(null); setProblem(''); }}
              className="w-full text-brand-600 hover:bg-brand-50 rounded-xl py-2 font-semibold text-sm transition-colors"
            >
              Fazer outra análise
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
