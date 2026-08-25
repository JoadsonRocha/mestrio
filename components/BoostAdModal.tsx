import React, { useState } from 'react';
import { X, Rocket, Sparkles, Star, CheckCircle2, Copy, Check, QrCode, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { ServiceAd } from '../types';
import { store } from '../services/store';
import { useToast } from '../context/ToastContext';

interface BoostAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: ServiceAd;
  onSuccess: () => void;
}

const BOOST_PLANS = [
  { id: '7days', name: '7 Dias no Topo', price: 9.90, days: 7, popular: false, badge: 'Iniciante' },
  { id: '15days', name: '15 Dias de Destaque', price: 19.90, days: 15, popular: true, badge: 'Mais Escolhido' },
  { id: '30days', name: '30 Dias de Alta Performance', price: 34.90, days: 30, popular: false, badge: 'Melhor Custo' },
];

export const BoostAdModal: React.FC<BoostAdModalProps> = ({
  isOpen,
  onClose,
  ad,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState('15days');
  const [copiedPix, setCopiedPix] = useState(false);
  const [step, setStep] = useState<'select' | 'payment'>('select');
  const [activating, setActivating] = useState(false);

  if (!isOpen) return null;

  const selectedPlan = BOOST_PLANS.find(p => p.id === selectedPlanId) || BOOST_PLANS[1];
  const pixKey = 'financeiro@mestrio.com.br';
  const pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=00020126580014br.gov.bcb.pix0136${encodeURIComponent(pixKey)}520400005303986540${selectedPlan.price.toFixed(2)}5802BR5910MESTRIO6009SAO_PAULO62070503***6304`;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    toast('Chave PIX copiada!', 'success');
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleConfirmBoost = async () => {
    setActivating(true);
    try {
      // Ativa o destaque no anúncio
      await store.updateAd(ad.id, {
        isPremium: true,
      });
      toast(`🚀 Anúncio "${ad.title}" turbinado com sucesso! Ele já está em destaque no topo das buscas.`, 'success');
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast('Erro ao ativar destaque do anúncio.', 'error');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header com Gradiente Dourado / Azul */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center">
                <Rocket size={20} />
              </div>
              <div>
                <h3 className="font-black text-base tracking-tight">Turbinar Anúncio & Destaque Topo</h3>
                <p className="text-xs text-slate-300">Fase 2: Conquiste até 3x mais clientes da sua região</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5">
          {step === 'select' ? (
            <>
              {/* Benefícios */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-center">
                  <Star size={18} className="text-amber-600 mx-auto mb-1 fill-amber-500" />
                  <p className="text-xs font-bold text-gray-900">1º nas Buscas</p>
                  <p className="text-[10px] text-gray-500">Topo da sua categoria</p>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-center">
                  <Sparkles size={18} className="text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-900">Selo Destaque</p>
                  <p className="text-[10px] text-gray-500">Borda e tag dourada</p>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-center">
                  <Zap size={18} className="text-emerald-600 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-900">3x Mais Contatos</p>
                  <p className="text-[10px] text-gray-500">Cliques no WhatsApp</p>
                </div>
              </div>

              {/* Escolha do Plano */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2.5">
                  Selecione o Período de Destaque:
                </label>
                <div className="space-y-2.5">
                  {BOOST_PLANS.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/60 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-brand-600 bg-brand-600' : 'border-gray-300'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{plan.name}</span>
                              {plan.popular && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  {plan.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{plan.days} dias de exibição prioritária no topo</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-gray-900">
                            R$ {plan.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep('payment')}
                  className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>Continuar para Pagamento</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Etapa de Pagamento PIX */}
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <QrCode size={24} />
                </div>
                <div>
                  <h4 className="font-black text-base text-gray-900">Pagamento Instantâneo via PIX</h4>
                  <p className="text-xs text-gray-500">
                    Plano selecionado: <strong>{selectedPlan.name}</strong> por <strong>R$ {selectedPlan.price.toFixed(2).replace('.', ',')}</strong>
                  </p>
                </div>

                {/* QR Code */}
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 inline-block shadow-2xs">
                  <img
                    src={pixQrCodeUrl}
                    alt="QR Code PIX"
                    className="w-40 h-40 mx-auto rounded-lg"
                  />
                </div>

                {/* Chave PIX Copia e Cola */}
                <div className="p-3 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-between gap-2 max-w-sm mx-auto">
                  <span className="text-xs font-mono text-gray-700 truncate">{pixKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 text-xs font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0"
                  >
                    {copiedPix ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copiedPix ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Ações */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmBoost}
                  disabled={activating}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{activating ? 'Ativando Destaque...' : 'Já paguei! Ativar Anúncio no Topo'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  ← Voltar e trocar período
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
