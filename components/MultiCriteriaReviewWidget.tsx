import React from 'react';
import { Star, Clock, Wrench, DollarSign, MessageSquare, Sparkles, CheckCircle2 } from 'lucide-react';
import { Review, ReviewCriteria } from '../types';

interface MultiCriteriaBreakdownProps {
  reviews: Review[];
  overallRating: number;
}

/**
 * Painel de Resumo Multi-Critérios (Padrão Directorist)
 * Exibe a média detalhada por 4 pilares essenciais de contratação.
 */
export const MultiCriteriaBreakdown: React.FC<MultiCriteriaBreakdownProps> = ({ reviews, overallRating }) => {
  // Calcula a média de cada critério
  const criteriaReviews = reviews.filter(r => r.criteria);
  const totalWithCriteria = criteriaReviews.length;

  const averages: ReviewCriteria = totalWithCriteria > 0
    ? {
        punctuality: Number((criteriaReviews.reduce((acc, r) => acc + (r.criteria?.punctuality || r.rating), 0) / totalWithCriteria).toFixed(1)),
        quality: Number((criteriaReviews.reduce((acc, r) => acc + (r.criteria?.quality || r.rating), 0) / totalWithCriteria).toFixed(1)),
        fairPrice: Number((criteriaReviews.reduce((acc, r) => acc + (r.criteria?.fairPrice || r.rating), 0) / totalWithCriteria).toFixed(1)),
        communication: Number((criteriaReviews.reduce((acc, r) => acc + (r.criteria?.communication || r.rating), 0) / totalWithCriteria).toFixed(1)),
      }
    : {
        punctuality: overallRating > 0 ? Number(overallRating.toFixed(1)) : 5.0,
        quality: overallRating > 0 ? Number(overallRating.toFixed(1)) : 5.0,
        fairPrice: overallRating > 0 ? Number(overallRating.toFixed(1)) : 5.0,
        communication: overallRating > 0 ? Number(overallRating.toFixed(1)) : 5.0,
      };

  const criteriaItems = [
    {
      id: 'punctuality',
      label: 'Pontualidade',
      icon: Clock,
      value: averages.punctuality,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
    },
    {
      id: 'quality',
      label: 'Qualidade do Serviço',
      icon: Wrench,
      value: averages.quality,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
    },
    {
      id: 'fairPrice',
      label: 'Preço Justo',
      icon: DollarSign,
      value: averages.fairPrice,
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
    },
    {
      id: 'communication',
      label: 'Comunicação & Atenção',
      icon: MessageSquare,
      value: averages.communication,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-700/50 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex flex-col items-center justify-center shadow-lg shrink-0">
            <span className="text-2xl font-black text-slate-950 leading-none">
              {overallRating > 0 ? overallRating.toFixed(1) : '5.0'}
            </span>
            <div className="flex items-center text-slate-950 mt-1">
              <Star size={11} fill="currentColor" />
            </div>
          </div>
          <div>
            <h4 className="text-base font-extrabold flex items-center gap-2 text-white">
              <span>Avaliação por Multi-Critérios</span>
              <span className="bg-white/10 text-amber-300 text-[10px] uppercase font-black px-2 py-0.5 rounded-full tracking-wider border border-white/10 flex items-center gap-1">
                <Sparkles size={10} /> Transparência
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Baseado em {reviews.length} {reviews.length === 1 ? 'avaliação real' : 'avaliações reais'} de clientes
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
          <CheckCircle2 size={15} /> 100% Avaliações Auditadas
        </div>
      </div>

      {/* Grid de 4 Pilares */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
        {criteriaItems.map((item) => {
          const Icon = item.icon;
          const percentage = Math.min(100, Math.max(0, (item.value / 5) * 100));
          return (
            <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Icon size={14} className="text-amber-400" />
                  {item.label}
                </span>
                <span className="font-extrabold text-amber-300 flex items-center gap-1">
                  <Star size={11} fill="currentColor" /> {item.value.toFixed(1)}
                </span>
              </div>
              <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${item.color}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface MultiCriteriaRatingInputProps {
  criteria: ReviewCriteria;
  onChange: (criteria: ReviewCriteria) => void;
}

/**
 * Seletor Interativo de 4 Pilares para o Formulário de Avaliação
 */
export const MultiCriteriaRatingInput: React.FC<MultiCriteriaRatingInputProps> = ({ criteria, onChange }) => {
  const handleScoreChange = (field: keyof ReviewCriteria, score: number) => {
    onChange({
      ...criteria,
      [field]: score,
    });
  };

  const fields: { key: keyof ReviewCriteria; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; desc: string }[] = [
    { key: 'punctuality', label: 'Pontualidade', icon: Clock, desc: 'Chegou no horário combinado ou avisou com antecedência?' },
    { key: 'quality', label: 'Qualidade do Serviço', icon: Wrench, desc: 'O trabalho foi bem executado e com bom acabamento?' },
    { key: 'fairPrice', label: 'Preço Justo', icon: DollarSign, desc: 'O valor cobrado foi condizente com o serviço entregue?' },
    { key: 'communication', label: 'Comunicação & Atenção', icon: MessageSquare, desc: 'Foi educado, atencioso e claro nas explicações?' },
  ];

  const overallAvg = (
    (criteria.punctuality + criteria.quality + criteria.fairPrice + criteria.communication) / 4
  ).toFixed(1);

  return (
    <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-900">Avalie os 4 Pilares do Atendimento</h4>
          <p className="text-xs text-gray-500">Sua avaliação ajuda outros clientes a escolherem com segurança.</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-gray-500 block">Média Geral</span>
          <span className="text-base font-black text-amber-500 flex items-center justify-end gap-1">
            <Star size={14} fill="currentColor" /> {overallAvg}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((f) => {
          const Icon = f.icon;
          const currentScore = criteria[f.key];
          return (
            <div key={f.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg hover:bg-gray-50/80 transition">
              <div className="flex-1">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Icon size={14} className="text-brand-600" />
                  {f.label}
                </span>
                <span className="text-[11px] text-gray-500 block">{f.desc}</span>
              </div>

              <div className="flex items-center gap-1 mt-1 sm:mt-0">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleScoreChange(f.key, star)}
                    className="p-1 text-gray-300 hover:text-amber-400 focus:outline-none transition-transform hover:scale-110"
                    title={`${star} estrelas`}
                  >
                    <Star
                      size={20}
                      className={star <= currentScore ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-gray-700 ml-1.5 w-4 text-center">
                  {currentScore}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Mini-Tags com os 4 critérios dentro do card de Review individual
 */
export const ReviewCriteriaBadges: React.FC<{ criteria?: ReviewCriteria }> = ({ criteria }) => {
  if (!criteria) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
        <Clock size={10} /> Pontualidade: {criteria.punctuality}★
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
        <Wrench size={10} /> Qualidade: {criteria.quality}★
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
        <DollarSign size={10} /> Preço: {criteria.fairPrice}★
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
        <MessageSquare size={10} /> Comunicação: {criteria.communication}★
      </span>
    </div>
  );
};
