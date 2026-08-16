import React from 'react';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  CreditCard,
  Phone,
  FileText,
  Camera,
} from 'lucide-react';
import { User, ServiceAd } from '../types';
import { useNavigate } from 'react-router-dom';

interface ProfileCompletionWidgetProps {
  user: User;
  ads?: ServiceAd[];
  onOpenKYC?: () => void;
}

export const ProfileCompletionWidget: React.FC<ProfileCompletionWidgetProps> = ({
  user,
  ads = [],
  onOpenKYC,
}) => {
  const navigate = useNavigate();

  // Calcular itens concluídos
  const items = [
    {
      id: 'photo',
      label: 'Foto de Perfil Profissional',
      done: !!user.avatar && !user.avatar.includes('default'),
      action: () => navigate('/dashboard/profile'),
      icon: Camera,
    },
    {
      id: 'bio',
      label: 'Biografia e Experiência',
      done: !!user.bio && user.bio.length > 20,
      action: () => navigate('/dashboard/profile'),
      icon: FileText,
    },
    {
      id: 'contact',
      label: 'WhatsApp / Telefone Verificado',
      done: !!user.phone && user.phone.length >= 10,
      action: () => navigate('/dashboard/profile'),
      icon: Phone,
    },
    {
      id: 'document',
      label: 'Verificação de Identidade (KYC)',
      done: !!user.isCertified,
      action: onOpenKYC || (() => navigate('/dashboard/profile')),
      icon: ShieldCheck,
    },
    {
      id: 'ad',
      label: 'Primeiro Anúncio de Serviço Ativo',
      done: ads.length > 0,
      action: () => navigate('/create-ad'),
      icon: Sparkles,
    },
  ];

  const completedCount = items.filter(i => i.done).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  // Se já estiver 100%, mostrar badge de perfil campeão
  if (percentage === 100) {
    return (
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-emerald-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-white">Perfil 100% Completo & Otimizado</h4>
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Campeão
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-0.5">
              Seu perfil conta com máxima relevância no algoritmo de busca do Mestrio.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
      {/* Header com barra de progresso */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-brand-600" />
            <h4 className="font-bold text-sm text-gray-900">Completude do seu Perfil Profissional</h4>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Perfis completos recebem até <strong className="text-brand-600">3.5x mais orçamentos</strong> e contatos no WhatsApp.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-lg font-black text-brand-600">{percentage}%</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage < 50
              ? 'bg-amber-500'
              : percentage < 80
              ? 'bg-blue-600'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Lista de Tarefas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.done ? undefined : item.action}
              disabled={item.done}
              className={`p-2.5 rounded-xl text-left text-xs transition flex items-center justify-between border ${
                item.done
                  ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900 cursor-default'
                  : 'bg-gray-50 hover:bg-brand-50/60 border-gray-200 hover:border-brand-200 text-gray-700 hover:text-brand-700 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {item.done ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <Circle size={16} className="text-gray-300 shrink-0" />
                )}
                <span className={`truncate font-medium ${item.done ? 'line-through text-gray-500' : ''}`}>
                  {item.label}
                </span>
              </div>

              {!item.done && (
                <ArrowRight size={13} className="text-brand-500 shrink-0 ml-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
