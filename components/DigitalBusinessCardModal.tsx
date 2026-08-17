import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Phone,
  Mail,
  MapPin,
  Star,
  ShieldCheck,
  QrCode,
  Sparkles,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { User, ServiceAd } from '../types';
import { useToast } from '../context/ToastContext';
import { VerifiedBadge } from './VerifiedBadge';

interface DigitalBusinessCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  ads?: ServiceAd[];
}

export const DigitalBusinessCardModal: React.FC<DigitalBusinessCardModalProps> = ({
  isOpen,
  onClose,
  user,
  ads = [],
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const profileUrl = `${window.location.origin}/#/provider/${user.id}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(profileUrl)}&color=0f172a&bgcolor=ffffff`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast('Link do seu perfil copiado com sucesso!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShareWhatsApp = () => {
    const text = `🛠️ *${user.name}* - Profissional no Mestrio\nConfira meus serviços, avaliações e solicite um orçamento direto pelo link:\n${profileUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Obter categorias principais dos anúncios
  const categories = Array.from(new Set(ads.map(a => a.category))).slice(0, 3);
  const avgRating = ads.length > 0
    ? (ads.reduce((acc, a) => acc + (a.rating || 5), 0) / ads.length).toFixed(1)
    : '5.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-amber-400" />
            <h3 className="font-bold text-sm">Cartão de Visita Digital</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cartão Visual para Apresentação */}
        <div className="p-6 space-y-5 bg-gray-50">
          <div
            ref={cardRef}
            className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-white/10"
          >
            {/* Background decorativo */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
              {/* Logo / Badge */}
              <div className="flex items-center justify-between">
                <span className="font-black tracking-wider text-xs uppercase bg-white/10 px-2.5 py-1 rounded-full text-blue-200 border border-white/10 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-400" /> MESTRIO PRO
                </span>
                {user.isCertified && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-200 bg-blue-900/70 px-2.5 py-0.5 rounded-full border border-blue-400/40">
                    <VerifiedBadge size={14} /> Verificado
                  </span>
                )}
              </div>

              {/* Informações do Profissional */}
              <div className="flex items-center gap-3.5 pt-1">
                <div className="relative">
                  <img
                    src={user.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`}
                    alt={user.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
                  />
                  {user.isCertified && (
                    <span className="absolute -bottom-1 -right-1 bg-slate-900 p-0.5 rounded-full shadow-sm">
                      <VerifiedBadge size={16} />
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-lg text-white leading-tight flex items-center gap-1.5">
                    <span>{user.name}</span>
                    {user.isCertified && <VerifiedBadge size="sm" />}
                  </h4>
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold mt-0.5">
                    <Star size={13} fill="currentColor" />
                    <span>{avgRating}</span>
                    <span className="text-slate-400 font-normal">({ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'})</span>
                  </div>
                  {user.location && (
                    <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                      <MapPin size={11} className="text-blue-400" /> {user.location}
                    </p>
                  )}
                </div>
              </div>

              {/* Especialidades / Tags */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-semibold bg-white/10 text-blue-100 px-2 py-0.5 rounded-md"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* QR Code & Contatos */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 flex items-center justify-between gap-3 pt-2">
                <div className="space-y-1.5 text-xs text-slate-200">
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-emerald-400" />
                      <span className="font-medium">{user.phone}</span>
                    </div>
                  )}
                  {user.email && (
                    <div className="flex items-center gap-2 truncate max-w-[180px]">
                      <Mail size={13} className="text-blue-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">mestrio.com.br</p>
                </div>

                <div className="bg-white p-1.5 rounded-lg shadow-md shrink-0">
                  <img
                    src={qrCodeImageUrl}
                    alt="QR Code do Perfil"
                    className="w-16 h-16 rounded"
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-center text-gray-500">
            Escaneie o QR Code ou compartilhe seu cartão para receber solicitações de orçamentos diretamente no WhatsApp.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full sm:flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Link Copiado!' : 'Copiar Link Curto'}
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full sm:flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
          >
            <MessageCircle size={15} />
            Enviar no WhatsApp
          </button>
        </div>

      </div>
    </div>
  );
};
