import React, { useState } from 'react';
import { Sparkles, FileText, Send, Copy, Check, Calculator, Clock, Wrench, ShieldCheck, DollarSign, User, Phone, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Representa um item individual em um orçamento gerado.
 */
interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Ferramenta avançada para profissionais criarem orçamentos detalhados.
 * Permite adicionar itens manualmente ou gerar uma estimativa automática usando IA.
 * Exporta o resultado formatado pronto para envio pelo WhatsApp.
 */
export const QuoteBuilder: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [category, setCategory] = useState('Eletricista');
  const [problemDescription, setProblemDescription] = useState('');
  
  const [items, setItems] = useState<QuoteItem[]>([
    { id: '1', description: 'Mão de Obra Especializada', quantity: 1, unitPrice: 250 }
  ]);

  const [estimatedDays, setEstimatedDays] = useState('1 dia');
  const [validityDays, setValidityDays] = useState('15 dias');
  const [paymentTerms, setPaymentTerms] = useState('50% na aprovação + 50% na entrega');
  const [notes, setNotes] = useState('Garantia de 90 dias sobre a mão de obra executada.');

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calcula total
  const totalPrice = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

  // Manipulação de Itens
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), description: 'Novo item / material', quantity: 1, unitPrice: 50 }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Gerar com IA
  const handleGenerateAI = async () => {
    if (!problemDescription.trim()) {
      toast('Descreva o problema do cliente para a IA gerar o orçamento.', 'error');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: problemDescription })
      });

      if (!res.ok) throw new Error('Falha ao conectar com o gerador de orçamento IA');
      const data = await res.json();

      // Extrai valores estimados da IA
      const priceText = data.price_range || 'R$ 200 a R$ 400';
      const numbers = priceText.match(/\d+/g);
      const avgPrice = numbers && numbers.length > 0 ? Number(numbers[0]) : 250;

      setItems([
        {
          id: '1',
          description: `Mão de Obra (${data.possible_issue || 'Manutenção e Reparo'})`,
          quantity: 1,
          unitPrice: avgPrice
        },
        ...(data.recommended_materials || []).map((mat: string, idx: number) => ({
          id: `mat-${idx}`,
          description: `Material: ${mat}`,
          quantity: 1,
          unitPrice: 40
        }))
      ]);

      if (data.estimated_time) setEstimatedDays(data.estimated_time);
      toast('Orçamento gerado pela IA com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao gerar com IA. Você pode preencher os itens manualmente.', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Montar Texto do Orçamento para Exportação
  const generateFormattedQuoteText = () => {
    const providerName = user?.name || 'Profissional Mestrio';
    const cleanPhone = clientPhone.replace(/\D/g, '');

    let text = `📄 *ORÇAMENTO DE SERVIÇO DE MANUTENÇÃO*\n`;
    text += `👤 *Prestador:* ${providerName}\n`;
    if (clientName) text += `📋 *Cliente:* ${clientName}\n`;
    text += `🏷️ *Categoria:* ${category}\n`;
    text += `-----------------------------------\n\n`;

    text += `🛠️ *ITENS & SERVIÇOS:*\n`;
    items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.description} - ${item.quantity}x R$ ${item.unitPrice.toFixed(2)} = *R$ ${(item.quantity * item.unitPrice).toFixed(2)}*\n`;
    });

    text += `\n💰 *VALOR TOTAL: R$ ${totalPrice.toFixed(2)}*\n`;
    text += `-----------------------------------\n`;
    text += `⏱️ *Prazo de Execução:* ${estimatedDays}\n`;
    text += `📅 *Validade da Proposta:* ${validityDays}\n`;
    text += `💳 *Forma de Pagamento:* ${paymentTerms}\n`;
    if (notes) text += `📌 *Observações:* ${notes}\n`;

    text += `\n_Enviado através da plataforma Mestrio._`;

    return { text, cleanPhone };
  };

  // Copiar Texto
  const handleCopy = () => {
    const { text } = generateFormattedQuoteText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast('Orçamento copiado para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  // Enviar pelo WhatsApp
  const handleSendWhatsApp = () => {
    const { text, cleanPhone } = generateFormattedQuoteText();
    const encoded = encodeURIComponent(text);
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 bg-gray-50 p-4 md:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-700 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-brand-200 mb-2">
              <Calculator size={14} /> Ferramenta Pro para Profissionais
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Gerador de Orçamentos Profissionais</h1>
            <p className="text-brand-100 text-sm mt-1">Crie propostas comerciais detalhadas, calcule custos e envie com 1 clique no WhatsApp do seu cliente.</p>
          </div>

          <button
            onClick={handleGenerateAI}
            disabled={isGeneratingAI}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs md:text-sm rounded-xl shadow-lg transition flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {isGeneratingAI ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-900 border-t-transparent"></span>
            ) : (
              <Sparkles size={16} />
            )}
            Gerar com IA
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Formulário de Criação */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center gap-2">
              <FileText size={18} className="text-brand-600" /> Dados do Orçamento
            </h2>

            {/* Dados do Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Cliente</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp do Cliente (Opcional)</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="Ex: 11999998888"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* Descrição do Problema para IA */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição do Serviço / Necessidade</label>
              <textarea
                value={problemDescription}
                onChange={e => setProblemDescription(e.target.value)}
                rows={3}
                placeholder="Ex: Troca de disjuntor geral queimado + revisão de 3 tomadas na cozinha."
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {/* Lista de Itens & Materiais */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-700">Itens, Materiais & Mão de Obra</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-brand-600 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <Plus size={14} /> Adicionar Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                      placeholder="Descrição do item"
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                      className="w-16 px-2 py-1.5 border border-gray-300 rounded text-xs text-center focus:ring-brand-500"
                    />
                    <div className="relative w-24">
                      <span className="absolute left-2 top-2 text-xs text-gray-500">R$</span>
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={e => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                        className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-xs text-right focus:ring-brand-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length === 1}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Condições Comerciais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Prazo Estimado</label>
                <input
                  type="text"
                  value={estimatedDays}
                  onChange={e => setEstimatedDays(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Validade do Orçamento</label>
                <input
                  type="text"
                  value={validityDays}
                  onChange={e => setValidityDays(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Forma de Pagamento</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs"
                />
              </div>
            </div>
          </div>

          {/* Pré-visualização & Exportação */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" /> Pré-visualização do Orçamento
                </h3>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-medium">Pronto para Envio</span>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 max-h-80 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                {generateFormattedQuoteText().text}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs">Valor Total Calculado:</p>
                  <p className="text-2xl font-black text-amber-400">R$ {totalPrice.toFixed(2)}</p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleSendWhatsApp}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Enviar Orçamento pelo WhatsApp
                </button>

                <button
                  onClick={handleCopy}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  {copied ? 'Copiado para Área de Transferência!' : 'Copiar Texto Formatado'}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
