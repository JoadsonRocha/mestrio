import React, { useState } from 'react';
import { DollarSign, Clock, X, Send } from 'lucide-react';
import { store } from '../services/store';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  adId?: string;
  onSuccess?: () => void;
}

export const QuoteModal: React.FC<Props> = ({ isOpen, onClose, clientId, clientName, adId, onSuccess }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [price, setPrice] = useState('');
  const [days, setDays] = useState('1');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || !desc.trim()) return;

    setSubmitting(true);
    try {
      await store.createQuoteProposal({
        adId,
        providerId: user.id,
        providerName: user.name,
        providerAvatar: user.avatar,
        clientId,
        estimatedPrice: Number(price),
        estimatedDays: Number(days),
        description: desc,
      });
      toast(`Orçamento enviado para ${clientName}!`, 'success');
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast('Erro ao enviar orçamento.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-gray-900 text-base flex items-center">
            <DollarSign size={18} className="text-green-600 mr-1" />
            Gerar Orçamento Rápido
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Envie uma proposta formal de orçamento direta para o cliente <strong>{clientName}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Valor Total (R$) *</label>
              <input
                type="number"
                required
                placeholder="Ex: 250"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Prazo Execução (Dias) *</label>
              <input
                type="number"
                required
                min="1"
                value={days}
                onChange={e => setDays(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição do Serviço / Condições *</label>
            <textarea
              required
              rows={4}
              placeholder="Descreva o escopo dos trabalhos, peças inclusas e forma de pagamento aceita."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 inline-flex items-center"
            >
              <Send size={14} className="mr-1.5" />
              {submitting ? 'Enviando...' : 'Enviar Orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
