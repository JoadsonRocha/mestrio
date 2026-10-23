import React from 'react';
import { Star, MapPin, CheckCircle, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCategories } from '../context/CategoriesContext';
import { ServiceAd } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { getBusinessStatus } from '../utils/businessHours';

/**
 * Componente visual de tag/selo (Badge).
 * Usado para destacar pequenos textos (ex: 'Novo', 'Pendente').
 */
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'primary' | 'secondary' | 'outline' }> = ({ children, variant = 'primary' }) => {
  const styles = {
    primary: 'bg-brand-100 text-brand-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-200 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
};

/**
 * Componente que renderiza de 1 a 5 estrelas baseadas em uma nota (rating).
 * Aceita exibir também a contagem de avaliações.
 */
export const RatingStars: React.FC<{ rating: number; count?: number; size?: number }> = ({ rating, count, size = 16 }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={`${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
        />
      ))}
      {count !== undefined && (
        <span className="ml-1 text-xs text-gray-500">({count})</span>
      )}
    </div>
  );
};

/**
 * Cartão de Serviço (Service Card).
 * Componente principal usado nas listagens e buscas para exibir um anúncio resumido.
 */
export const ServiceCard: React.FC<{ ad: ServiceAd; compact?: boolean }> = ({ ad, compact = false }) => {
  const navigate = useNavigate();
  const { options } = useCategories();
  const businessStatus = getBusinessStatus(ad.availability);

  return (
    <Link to={`/service/${ad.id}`} className="group bg-white rounded-2xl shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden border border-slate-200/70 hover:border-brand-300 flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <div className={`relative ${compact ? 'h-[100px] md:h-[140px]' : 'aspect-[16/10]'} overflow-hidden bg-slate-100`}>
        {ad.images && ad.images[0] ? (
          <img 
            src={ad.images[0]} 
            alt={ad.title} 
            loading="lazy" 
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
            <span className="text-xs font-medium">Sem foto</span>
          </div>
        )}

        {/* Tag de Disponibilidade: Atendendo Agora / Fechado */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs border border-slate-200/80">
          <span className={`w-2 h-2 rounded-full shrink-0 ${businessStatus.isOpen ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-400'}`}></span>
          <span className={businessStatus.isOpen ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
            {businessStatus.shortBadge}
          </span>
        </div>

        {ad.isPremium && (
          <div className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs flex items-center z-10">
            <Star size={11} className="mr-1 fill-current" /> Destaque
          </div>
        )}
        <div className="absolute bottom-2.5 left-2.5 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-0.5 rounded-md">
            {options.find(c => c.id === ad.category)?.label || ad.category}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-base font-semibold text-gray-900 line-clamp-1 group-hover:text-brand-600 transition-colors">
            {ad.title}
            </h3>
        </div>
        
        {ad.tags && ad.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
                {ad.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100">
                        {tag}
                    </span>
                ))}
                {ad.tags.length > 2 && (
                    <span className="text-[10px] font-medium bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">
                        +{ad.tags.length - 2}
                    </span>
                )}
            </div>
        )}

        <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">
          {ad.description}
        </p>

        <div className="mt-auto space-y-3">
             <div className="flex items-center text-xs text-gray-500">
                <MapPin size={14} className="mr-1 text-gray-400 shrink-0" />
                <span className="truncate">{ad.location}</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/profissional/${ad.providerId}`);
                    }}
                    className="flex items-center space-x-2 group/profile hover:bg-gray-50 p-1 -ml-1 rounded-lg transition-colors text-left"
                    title={`Ver perfil de ${ad.providerName || 'Profissional'}`}
                >
                    <div className="w-7 h-7 rounded-full bg-brand-100 ring-1 ring-brand-200 flex items-center justify-center text-brand-700 text-xs font-bold group-hover/profile:bg-brand-600 group-hover/profile:text-white transition-colors overflow-hidden shrink-0 shadow-xs">
                        {ad.providerAvatar ? (
                          <img 
                            src={ad.providerAvatar} 
                            alt={ad.providerName || 'Profissional'} 
                            loading="lazy" 
                            decoding="async" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{(ad.providerName || 'P').charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-gray-800 group-hover/profile:text-brand-600 truncate max-w-[110px] flex items-center gap-1 transition-colors">
                          {ad.providerName || 'Profissional'}
                          {ad.isCertified && <VerifiedBadge size="xs" tooltip="Profissional Verificado Mestrio" />}
                      </span>
                    </div>
                </button>
                <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                        {ad.price === 0 ? 'A combinar' : `R$ ${ad.price}`}
                    </span>
                    {ad.price > 0 && <span className="text-xs text-gray-500 ml-1">/{ad.priceUnit === 'hour' ? 'h' : 'serviço'}</span>}
                </div>
            </div>
        </div>
      </div>
    </Link>
  );
};

/**
 * Botão em formato de pílula arredondada usado para selecionar filtros e categorias.
 */
export const CategoryPill: React.FC<{ id: string; label: string; active?: boolean; onClick: () => void; icon?: React.ReactNode }> = ({ id, label, active, onClick, icon }) => {
    return (
        <button
            onClick={onClick}
            className={`
                whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                ${active 
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md transform scale-105' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }
            `}
        >
            <div className="flex items-center space-x-2">
                {icon && <span>{icon}</span>}
                <span>{label}</span>
            </div>
        </button>
    )
}
