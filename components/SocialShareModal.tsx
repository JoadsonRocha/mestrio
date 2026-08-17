import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, Send, Globe } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url?: string;
  description?: string;
  imageUrl?: string;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  title,
  url,
  description,
  imageUrl
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = url || window.location.href;
  const shareText = description ? `${title} - ${description}` : title;
  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedText = encodeURIComponent(shareText);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast('Link copiado para a área de transferência!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('Não foi possível copiar o link.', 'error');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: currentUrl
        });
        toast('Compartilhado com sucesso!', 'success');
        onClose();
      } catch (err) {
        // Usuário cancelou
      }
    }
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      border: 'border-emerald-500/20',
      action: () => {
        window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'Facebook',
      icon: Globe,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      border: 'border-blue-600/20',
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'Telegram',
      icon: Send,
      color: 'bg-sky-500 hover:bg-sky-600 text-white',
      border: 'border-sky-500/20',
      action: () => {
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
      }
    },
    {
      name: 'Twitter / X',
      icon: Share2,
      color: 'bg-slate-900 hover:bg-black text-white',
      border: 'border-slate-700',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank');
      }
    },
    {
      name: 'LinkedIn',
      icon: Globe,
      color: 'bg-blue-700 hover:bg-blue-800 text-white',
      border: 'border-blue-700/20',
      action: () => {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank');
      }
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-scaleUp">
        
        {/* Header com Avatar / Foto do Usuário */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="w-10 h-10 rounded-full object-cover border-2 border-brand-400 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-400 shrink-0">
                <Share2 size={16} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{title}</h3>
              <p className="text-[11px] text-slate-400 truncate">Compartilhar no WhatsApp e redes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4">
          
          {/* Botões de Redes Sociais */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {shareOptions.map(option => (
              <button
                key={option.name}
                type="button"
                onClick={option.action}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition shadow-xs active:scale-95 border ${option.color} ${option.border}`}
              >
                <option.icon size={20} className="mb-1.5" />
                <span className="text-[10px] font-bold tracking-tight">{option.name}</span>
              </button>
            ))}
          </div>

          {/* Compartilhamento Nativo do Celular (se disponível) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-brand-200"
            >
              <Share2 size={14} /> Mais opções de compartilhamento do dispositivo
            </button>
          )}

          {/* Campo de Copiar Link */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-[11px] font-bold text-gray-600 mb-1.5">
              Link Direto
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-mono focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-lg transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
