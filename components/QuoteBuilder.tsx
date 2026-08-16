import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Send,
  Copy,
  Check,
  Calculator,
  Clock,
  Wrench,
  ShieldCheck,
  DollarSign,
  User,
  Phone,
  Plus,
  Trash2,
  Download,
  UploadCloud,
  Layers,
  Printer,
  Save,
  FolderOpen,
  X,
  FileSpreadsheet,
  FileCheck,
  CreditCard,
  MapPin,
  Mail,
  Tag,
  Percent,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  PenTool,
  Receipt,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { store } from '../services/store';
import { DetailedQuote, DetailedQuoteItem, QuoteStatus } from '../types';
import {
  generateQuotePDF,
  generateQuoteDOCX,
  generateReceiptPDF,
  QUOTE_TEMPLATES,
  formatCurrency,
  getItemTypeLabel,
} from '../utils/quoteDocument';
import { QuoteImportModal } from './QuoteImportModal';
import { DigitalSignatureModal } from './DigitalSignatureModal';

export const QuoteBuilder: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados do Orçamento
  const [quoteId, setQuoteId] = useState<string>(() => `orc-${Date.now()}`);
  const [quoteNumber, setQuoteNumber] = useState<string>(() => `ORC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [title, setTitle] = useState('Proposta Comercial de Prestação de Serviços');
  const [category, setCategory] = useState('Eletricista');
  const [problemDescription, setProblemDescription] = useState('');
  const [status, setStatus] = useState<QuoteStatus>('draft');

  // Assinaturas Digitais & Quitação
  const [providerSignature, setProviderSignature] = useState<string | undefined>(undefined);
  const [clientSignature, setClientSignature] = useState<string | undefined>(undefined);
  const [signedAt, setSignedAt] = useState<string | undefined>(undefined);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureRole, setSignatureRole] = useState<'provider' | 'client'>('provider');
  const [paidAt, setPaidAt] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');

  // Dados do Prestador
  const [providerName, setProviderName] = useState(user?.name || '');
  const [providerDocument, setProviderDocument] = useState('');
  const [providerPhone, setProviderPhone] = useState(user?.phone || '');
  const [providerEmail, setProviderEmail] = useState(user?.email || '');
  const [providerPixKey, setProviderPixKey] = useState('');
  const [providerCity, setProviderCity] = useState(user?.location || '');

  // Dados do Cliente
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientDocument, setClientDocument] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Itens & Materiais
  const [items, setItems] = useState<DetailedQuoteItem[]>([
    {
      id: 'item-1',
      description: 'Mão de Obra Especializada para Execução do Serviço',
      type: 'labor',
      quantity: 1,
      unit: 'serviço',
      unitPrice: 250,
      totalPrice: 250,
    },
  ]);

  // Condições Comerciais & Descontos
  const [estimatedDays, setEstimatedDays] = useState('1 a 2 dias úteis');
  const [validityDays, setValidityDays] = useState('15 dias corridos');
  const [paymentTerms, setPaymentTerms] = useState('50% na aprovação (PIX) + 50% na entrega');
  const [warranty, setWarranty] = useState('Garantia de 90 dias conforme Art. 26 do Código de Defesa do Consumidor.');
  const [notes, setNotes] = useState('Valores incluem deslocamento e ferramental profissional necessário.');
  
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [travelFee, setTravelFee] = useState<number>(0);

  // Estados de UI
  const [activeTab, setActiveTab] = useState<'items' | 'client' | 'provider' | 'terms'>('items');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<DetailedQuote[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Carregar histórico de orçamentos salvos
  const loadSavedQuotes = async () => {
    try {
      const quotes = await store.getDetailedQuotes(user?.id);
      setSavedQuotes(quotes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSavedQuotes();
  }, [user]);

  // Sincronizar dados do usuário autenticado caso mudem
  useEffect(() => {
    if (user) {
      if (!providerName) setProviderName(user.name);
      if (!providerPhone && user.phone) setProviderPhone(user.phone);
      if (!providerEmail && user.email) setProviderEmail(user.email);
      if (!providerCity && user.location) setProviderCity(user.location);
    }
  }, [user]);

  // Cálculos Financeiros
  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const discountAmount = discountType === 'percent'
    ? (subtotal * (discountValue || 0)) / 100
    : (discountValue || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount + (travelFee || 0));

  // Manipulação de Itens
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: 'Novo item / material ou serviço',
        type: 'material',
        quantity: 1,
        unit: 'un',
        unitPrice: 50,
        totalPrice: 50,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast('O orçamento deve possuir pelo menos 1 item.', 'error');
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof DetailedQuoteItem, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          updated.totalPrice = updated.quantity * updated.unitPrice;
          return updated;
        }
        return item;
      })
    );
  };

  // Construir objeto do orçamento atual
  const getCurrentQuoteObject = (): DetailedQuote => {
    return {
      id: quoteId,
      quoteNumber,
      providerId: user?.id || 'guest-provider',
      providerName: providerName || 'Profissional Mestrio',
      providerDocument,
      providerPhone,
      providerEmail,
      providerPixKey,
      providerCity,

      clientName: clientName || 'Cliente',
      clientDocument,
      clientPhone,
      clientEmail,
      clientAddress,

      title: title || 'Proposta Comercial de Prestação de Serviços',
      category,
      problemDescription,

      items,

      subtotal,
      discountType,
      discountValue: discountValue || 0,
      travelFee: travelFee || 0,
      totalAmount,

      estimatedDays,
      validityDays,
      paymentTerms,
      warranty,
      notes,

      status,
      providerSignature,
      clientSignature,
      signedAt,
      paidAt,
      paymentMethod,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Carregar um orçamento nos campos do formulário
  const loadQuoteIntoForm = (quote: Partial<DetailedQuote>) => {
    if (quote.id) setQuoteId(quote.id);
    if (quote.quoteNumber) setQuoteNumber(quote.quoteNumber);
    if (quote.title) setTitle(quote.title);
    if (quote.category) setCategory(quote.category);
    if (quote.problemDescription) setProblemDescription(quote.problemDescription);
    if (quote.status) setStatus(quote.status);

    if (quote.providerName) setProviderName(quote.providerName);
    if (quote.providerDocument) setProviderDocument(quote.providerDocument);
    if (quote.providerPhone) setProviderPhone(quote.providerPhone);
    if (quote.providerEmail) setProviderEmail(quote.providerEmail);
    if (quote.providerPixKey) setProviderPixKey(quote.providerPixKey);
    if (quote.providerCity) setProviderCity(quote.providerCity);

    if (quote.clientName) setClientName(quote.clientName);
    if (quote.clientDocument) setClientDocument(quote.clientDocument);
    if (quote.clientPhone) setClientPhone(quote.clientPhone);
    if (quote.clientEmail) setClientEmail(quote.clientEmail);
    if (quote.clientAddress) setClientAddress(quote.clientAddress);

    if (quote.providerSignature) setProviderSignature(quote.providerSignature);
    if (quote.clientSignature) setClientSignature(quote.clientSignature);
    if (quote.signedAt) setSignedAt(quote.signedAt);
    if (quote.paidAt) setPaidAt(quote.paidAt);
    if (quote.paymentMethod) setPaymentMethod(quote.paymentMethod);

    if (quote.items && quote.items.length > 0) {
      setItems(quote.items.map(it => ({
        ...it,
        id: it.id || `item-${Math.random()}`,
        unit: it.unit || 'un',
        type: it.type || 'labor',
        totalPrice: it.quantity * it.unitPrice,
      })));
    }

    if (quote.estimatedDays) setEstimatedDays(quote.estimatedDays);
    if (quote.validityDays) setValidityDays(quote.validityDays);
    if (quote.paymentTerms) setPaymentTerms(quote.paymentTerms);
    if (quote.warranty) setWarranty(quote.warranty);
    if (quote.notes !== undefined) setNotes(quote.notes);

    if (quote.discountType) setDiscountType(quote.discountType);
    if (quote.discountValue !== undefined) setDiscountValue(quote.discountValue);
    if (quote.travelFee !== undefined) setTravelFee(quote.travelFee);
  };

  // Limpar formulário para novo orçamento
  const handleResetForm = () => {
    setQuoteId(`orc-${Date.now()}`);
    setQuoteNumber(`ORC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setTitle('Proposta Comercial de Prestação de Serviços');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientDocument('');
    setClientAddress('');
    setProblemDescription('');
    setStatus('draft');
    setDiscountValue(0);
    setTravelFee(0);
    setProviderSignature(undefined);
    setClientSignature(undefined);
    setSignedAt(undefined);
    setPaidAt(undefined);
    setItems([
      {
        id: 'item-1',
        description: 'Mão de Obra Especializada para Execução do Serviço',
        type: 'labor',
        quantity: 1,
        unit: 'serviço',
        unitPrice: 250,
        totalPrice: 250,
      },
    ]);
    toast('Novo orçamento iniciado!', 'info');
  };

  // Salvar Orçamento no Storage / Histórico
  const handleSaveQuote = async () => {
    setIsSaving(true);
    try {
      const quoteObj = getCurrentQuoteObject();
      await store.saveDetailedQuote(quoteObj);
      await loadSavedQuotes();
      toast('Orçamento salvo com sucesso no seu histórico!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao salvar orçamento.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Gerar com IA
  const handleGenerateAI = async () => {
    if (!problemDescription.trim()) {
      toast('Descreva a necessidade ou defeito para a IA estruturar o orçamento.', 'error');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: problemDescription }),
      });

      if (!res.ok) throw new Error('Falha ao conectar com a IA');
      const data = await res.json();

      const priceText = data.price_range || 'R$ 200 a R$ 400';
      const numbers = priceText.match(/\d+/g);
      const avgPrice = numbers && numbers.length > 0 ? Number(numbers[0]) : 250;

      const newItems: DetailedQuoteItem[] = [
        {
          id: `ai-labor-${Date.now()}`,
          description: `Mão de Obra Especializada (${data.possible_issue || 'Manutenção e Reparo'})`,
          type: 'labor',
          quantity: 1,
          unit: 'serviço',
          unitPrice: avgPrice,
          totalPrice: avgPrice,
        },
        ...(data.recommended_materials || []).map((mat: string, idx: number) => ({
          id: `ai-mat-${idx}-${Date.now()}`,
          description: `Material / Peça: ${mat}`,
          type: 'material' as const,
          quantity: 1,
          unit: 'un',
          unitPrice: 45,
          totalPrice: 45,
        })),
      ];

      setItems(newItems);
      if (data.estimated_time) setEstimatedDays(data.estimated_time);
      if (data.category) setCategory(data.category);

      toast('Orçamento estruturado automaticamente pela IA!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao gerar com IA. Você pode preencher os itens manualmente.', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    try {
      const quoteObj = getCurrentQuoteObject();
      await generateQuotePDF(quoteObj);
      toast('PDF gerado e baixado com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao gerar documento PDF.', 'error');
    }
  };

  // Exportar DOCX
  const handleExportDOCX = async () => {
    try {
      const quoteObj = getCurrentQuoteObject();
      await generateQuoteDOCX(quoteObj);
      toast('Documento Word (.docx) gerado com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao gerar documento Word.', 'error');
    }
  };

  // Montar Texto Formatado para WhatsApp e Área de Transferência
  const generateFormattedQuoteText = () => {
    const pName = providerName || 'Profissional Mestrio';
    const cleanPhone = clientPhone.replace(/\D/g, '');

    let text = `📄 *ORÇAMENTO DE PRESTAÇÃO DE SERVIÇOS*\n`;
    text += `🔢 *Nº:* ${quoteNumber}\n`;
    text += `👤 *Prestador:* ${pName}\n`;
    if (providerPhone) text += `📞 *Contato:* ${providerPhone}\n`;
    if (providerPixKey) text += `🔑 *Chave PIX:* ${providerPixKey}\n`;
    text += `-----------------------------------\n`;
    if (clientName) text += `📋 *Cliente:* ${clientName}\n`;
    if (clientAddress) text += `📍 *Local:* ${clientAddress}\n`;
    text += `🏷️ *Categoria:* ${category}\n`;
    text += `📌 *Assunto:* ${title}\n`;
    text += `-----------------------------------\n\n`;

    text += `🛠️ *ITENS & SERVIÇOS INCLUSOS:*\n`;
    items.forEach((item, idx) => {
      text += `${idx + 1}. [${getItemTypeLabel(item.type)}] ${item.description}\n`;
      text += `   ↳ ${item.quantity} ${item.unit} x ${formatCurrency(item.unitPrice)} = *${formatCurrency(item.quantity * item.unitPrice)}*\n`;
    });

    text += `\n-----------------------------------\n`;
    text += `Subtotal: ${formatCurrency(subtotal)}\n`;
    if (discountValue > 0) {
      text += `Desconto: - ${formatCurrency(discountAmount)}\n`;
    }
    if (travelFee > 0) {
      text += `Taxa Deslocamento: + ${formatCurrency(travelFee)}\n`;
    }
    text += `💰 *VALOR TOTAL: ${formatCurrency(totalAmount)}*\n`;
    text += `-----------------------------------\n`;
    text += `⏱️ *Prazo de Execução:* ${estimatedDays}\n`;
    text += `📅 *Validade da Proposta:* ${validityDays}\n`;
    text += `💳 *Forma de Pagamento:* ${paymentTerms}\n`;
    if (warranty) text += `🛡️ *Garantia:* ${warranty}\n`;
    if (notes) text += `📌 *Observações:* ${notes}\n`;

    text += `\n_Emitido através da plataforma Mestrio - www.mestrio.com.br_`;

    return { text, cleanPhone };
  };

  // Copiar Texto
  const handleCopy = () => {
    const { text } = generateFormattedQuoteText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast('Texto do orçamento copiado para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  // Enviar pelo WhatsApp
  const handleSendWhatsApp = () => {
    const { text, cleanPhone } = generateFormattedQuoteText();
    const encoded = encodeURIComponent(text);
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Impressão Direta
  const handlePrint = () => {
    window.print();
  };

  // Filtragem no Histórico
  const filteredHistory = savedQuotes.filter(q => {
    const matchesFilter = historyFilter === 'all' || q.status === historyFilter;
    const matchesSearch =
      q.clientName.toLowerCase().includes(historySearch.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
      q.title.toLowerCase().includes(historySearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 bg-gray-50 p-4 md:p-6 overflow-y-auto print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Banner Superior com Ações Principais */}
        <div className="bg-gradient-to-r from-blue-900 via-brand-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-xs rounded-full text-xs font-semibold text-blue-200 mb-2">
              <Calculator size={14} /> Sistema Avançado de Orçamentos Comerciais
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Gerador & Emissor de Orçamentos</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-2xl">
              Crie propostas comerciais de alto impacto, exporte em <strong>PDF Timbrado</strong> ou <strong>Word (.docx)</strong>, importe arquivos existentes e envie direto no WhatsApp do cliente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsTemplatesModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 border border-white/20"
            >
              <Layers size={15} className="text-amber-300" />
              Modelos Rápidos
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 border border-white/20"
            >
              <UploadCloud size={15} className="text-blue-300" />
              Importar DOCX / PDF
            </button>

            <button
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 border border-white/20 relative"
            >
              <FolderOpen size={15} className="text-emerald-300" />
              Meus Orçamentos
              {savedQuotes.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  {savedQuotes.length}
                </span>
              )}
            </button>

            <button
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              {isGeneratingAI ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent"></span>
              ) : (
                <Sparkles size={15} />
              )}
              {isGeneratingAI ? 'Gerando...' : 'Gerar com IA'}
            </button>
          </div>
        </div>

        {/* Layout Principal: Formulário de Edição & Pré-visualização Lateral */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LADO ESQUERDO: Formulário Modular (7 Colunas) */}
          <div className="lg:col-span-7 space-y-5 print:hidden">
            
            {/* Seletor de Abas do Formulário */}
            <div className="bg-white rounded-2xl p-1.5 shadow-xs border border-gray-200 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'items'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Tag size={14} /> Itens & Valores ({items.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('client')}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'client'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <User size={14} /> Dados do Cliente
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('provider')}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'provider'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <CreditCard size={14} /> Meus Dados & PIX
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'terms'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ShieldCheck size={14} /> Condições & Taxas
              </button>
            </div>

            {/* Conteúdo da Aba 1: ITENS & VALORES */}
            {activeTab === 'items' && (
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FileText size={18} className="text-brand-600" /> Itens, Mão de Obra e Materiais
                    </h2>
                    <p className="text-xs text-gray-500">Discrimine cada etapa do serviço para transparência com o cliente</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto border border-brand-200"
                  >
                    <Plus size={15} /> Adicionar Item
                  </button>
                </div>

                {/* Título & Categoria da Proposta */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Título / Assunto da Proposta</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Ex: Reforma Elétrica Completa e Troca de Disjuntores"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Categoria Principal</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                    >
                      <option value="Eletricista">Eletricista</option>
                      <option value="Encanador">Encanador</option>
                      <option value="Pintor">Pintor</option>
                      <option value="Climatização">Climatização</option>
                      <option value="Montador">Montador de Móveis</option>
                      <option value="Pedreiro">Pedreiro / Alvenaria</option>
                      <option value="Diarista">Limpeza / Diarista</option>
                      <option value="Marido de Aluguel">Marido de Aluguel</option>
                      <option value="Outros">Outros Serviços</option>
                    </select>
                  </div>
                </div>

                {/* Descrição do Problema / Prompt IA */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Descrição Detalhada do Problema / Necessidade (usada também pela IA):
                  </label>
                  <textarea
                    rows={2}
                    value={problemDescription}
                    onChange={e => setProblemDescription(e.target.value)}
                    placeholder="Ex: Troca de fiação de 2 chuveiros para 6mm² + substituição de disjuntor bipolar 40A que está desarmando."
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                {/* Lista de Itens */}
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-gray-50/80 hover:bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-brand-100 text-brand-700 rounded-full text-[10px] font-black flex items-center justify-center">
                            {index + 1}
                          </span>
                          <select
                            value={item.type}
                            onChange={e => handleUpdateItem(item.id, 'type', e.target.value)}
                            className="text-[11px] font-semibold bg-white border border-gray-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="labor">🛠️ Mão de Obra</option>
                            <option value="material">📦 Material</option>
                            <option value="service">⚡ Serviço</option>
                            <option value="tax">🚗 Taxa</option>
                            <option value="other">📋 Outro</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-800">
                            Total: {formatCurrency(item.quantity * item.unitPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length === 1}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition disabled:opacity-30"
                            title="Remover Item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Descrição do Item */}
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="Descrição clara do item, peça ou mão de obra"
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                      />

                      {/* Qtd, Unidade e Preço Unitário */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Quantidade</label>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={item.quantity}
                            onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs text-center focus:ring-1 focus:ring-brand-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Unidade</label>
                          <select
                            value={item.unit}
                            onChange={e => handleUpdateItem(item.id, 'unit', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="un">un (Unidade)</option>
                            <option value="hrs">hrs (Horas)</option>
                            <option value="serviço">serviço</option>
                            <option value="m²">m² (Metro Quadrado)</option>
                            <option value="m">m (Metro Linear)</option>
                            <option value="diária">diária</option>
                            <option value="kit">kit / conjunto</option>
                            <option value="gl">gl (Galão)</option>
                            <option value="kg">kg (Quilo)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Preço Unitário (R$)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={e => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs text-right font-semibold focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between items-center border-t">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    <Plus size={15} /> Adicionar mais um item
                  </button>

                  <div className="text-right">
                    <span className="text-xs text-gray-500">Subtotal dos Itens: </span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo da Aba 2: DADOS DO CLIENTE */}
            {activeTab === 'client' && (
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200 space-y-4">
                <div className="border-b pb-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <User size={18} className="text-brand-600" /> Informações do Cliente & Local da Obra
                  </h2>
                  <p className="text-xs text-gray-500">Preencha para personalizar o cabeçalho do documento oficial</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Completo do Cliente *</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="Ex: Carla Vasconcelos"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp / Telefone *</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        placeholder="Ex: (11) 98765-4321"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail do Cliente (Opcional)</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        placeholder="Ex: cliente@email.com"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CPF ou CNPJ (Opcional)</label>
                    <input
                      type="text"
                      value={clientDocument}
                      onChange={e => setClientDocument(e.target.value)}
                      placeholder="Ex: 123.456.789-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Endereço de Execução do Serviço</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={clientAddress}
                        onChange={e => setClientAddress(e.target.value)}
                        placeholder="Ex: Rua das Flores, 142 - Apto 34B - Jardim Paulista, SP"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo da Aba 3: DADOS DO PRESTADOR & PIX */}
            {activeTab === 'provider' && (
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200 space-y-4">
                <div className="border-b pb-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard size={18} className="text-brand-600" /> Dados Comerciais do Prestador & Chave PIX
                  </h2>
                  <p className="text-xs text-gray-500">Suas informações aparecerão no cabeçalho e rodapé do documento comercial</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Comercial / Razão Social</label>
                    <input
                      type="text"
                      value={providerName}
                      onChange={e => setProviderName(e.target.value)}
                      placeholder="Ex: Silva Manutenções Elétricas"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Seu CPF ou CNPJ / MEI</label>
                    <input
                      type="text"
                      value={providerDocument}
                      onChange={e => setProviderDocument(e.target.value)}
                      placeholder="Ex: 00.000.000/0001-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Telefone / WhatsApp Profissional</label>
                    <input
                      type="text"
                      value={providerPhone}
                      onChange={e => setProviderPhone(e.target.value)}
                      placeholder="Ex: (11) 99999-8888"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Chave PIX p/ Pagamento de Entrada</label>
                    <input
                      type="text"
                      value={providerPixKey}
                      onChange={e => setProviderPixKey(e.target.value)}
                      placeholder="Ex: financeiro@silva.com ou Celular"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail Profissional</label>
                    <input
                      type="email"
                      value={providerEmail}
                      onChange={e => setProviderEmail(e.target.value)}
                      placeholder="Ex: contato@profissionais.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade / Estado de Atuação</label>
                    <input
                      type="text"
                      value={providerCity}
                      onChange={e => setProviderCity(e.target.value)}
                      placeholder="Ex: São Paulo, SP"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo da Aba 4: CONDIÇÕES, DESCONTOS & TAXAS */}
            {activeTab === 'terms' && (
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200 space-y-4">
                <div className="border-b pb-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-brand-600" /> Condições Comerciais, Descontos & Prazos
                  </h2>
                  <p className="text-xs text-gray-500">Defina garantias, formas de pagamento e descontos promocionais</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Prazo de Execução</label>
                    <input
                      type="text"
                      value={estimatedDays}
                      onChange={e => setEstimatedDays(e.target.value)}
                      placeholder="Ex: 1 dia útil"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Validade da Proposta</label>
                    <input
                      type="text"
                      value={validityDays}
                      onChange={e => setValidityDays(e.target.value)}
                      placeholder="Ex: 15 dias"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Status da Proposta</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as QuoteStatus)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-semibold"
                    >
                      <option value="draft">🟡 Rascunho</option>
                      <option value="sent">🔵 Enviado ao Cliente</option>
                      <option value="approved">🟢 Aprovado</option>
                      <option value="completed">✅ Concluído</option>
                      <option value="rejected">🔴 Recusado</option>
                    </select>
                  </div>
                </div>

                {/* Descontos e Taxa de Deslocamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Desconto Aplicado</span>
                      <div className="inline-flex rounded-md shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setDiscountType('percent')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-l-md ${
                            discountType === 'percent' ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType('fixed')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-r-md ${
                            discountType === 'fixed' ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          R$
                        </button>
                      </div>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Taxa de Deslocamento / Visita (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={travelFee}
                      onChange={e => setTravelFee(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Condições de Pagamento</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    placeholder="Ex: 50% na aprovação (PIX) e 50% na conclusão"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Termos de Garantia</label>
                  <input
                    type="text"
                    value={warranty}
                    onChange={e => setWarranty(e.target.value)}
                    placeholder="Ex: 90 dias conforme CDC sobre serviços executados."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Observações Gerais</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações complementares sobre acesso, materiais não inclusos, etc."
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                {/* Bloco de Assinaturas Digitais */}
                <div className="pt-3 border-t border-gray-200">
                  <h3 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                    <PenTool size={14} className="text-brand-600" /> Assinaturas Digitais no Documento
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Assinatura do Prestador */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <span>Prestador (Emitente)</span>
                        {providerSignature ? (
                          <span className="text-emerald-600 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Assinado
                          </span>
                        ) : (
                          <span className="text-amber-600 text-[11px]">Pendente</span>
                        )}
                      </div>

                      {providerSignature ? (
                        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                          <img src={providerSignature} alt="Assinatura Prestador" className="h-10 object-contain max-w-[120px]" />
                          <button
                            type="button"
                            onClick={() => {
                              setSignatureRole('provider');
                              setIsSignatureModalOpen(true);
                            }}
                            className="text-xs text-brand-600 hover:underline font-medium"
                          >
                            Refazer
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSignatureRole('provider');
                            setIsSignatureModalOpen(true);
                          }}
                          className="w-full py-2 bg-white hover:bg-brand-50 border border-brand-300 text-brand-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <PenTool size={13} /> Assinar Documento
                        </button>
                      )}
                    </div>

                    {/* Assinatura do Cliente */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <span>Cliente (Aprovação)</span>
                        {clientSignature ? (
                          <span className="text-emerald-600 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Assinado
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Opcional</span>
                        )}
                      </div>

                      {clientSignature ? (
                        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                          <img src={clientSignature} alt="Assinatura Cliente" className="h-10 object-contain max-w-[120px]" />
                          <button
                            type="button"
                            onClick={() => {
                              setSignatureRole('client');
                              setIsSignatureModalOpen(true);
                            }}
                            className="text-xs text-brand-600 hover:underline font-medium"
                          >
                            Refazer
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSignatureRole('client');
                            setIsSignatureModalOpen(true);
                          }}
                          className="w-full py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <CheckSquare size={13} /> Coletar Aceite do Cliente
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Barra de Ações Rápidas Abaixo do Form */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCcw size={14} /> Novo Orçamento (Limpar)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveQuote}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={14} />
                  {isSaving ? 'Salvando...' : 'Salvar no Histórico'}
                </button>
              </div>
            </div>

          </div>

          {/* LADO DIREITO: Pré-visualização do Documento & Download/Exportação (5 Colunas) */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-5 sticky top-4">
              
              {/* Header do Box */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  <h3 className="font-bold text-sm text-slate-100">Documento Oficial</h3>
                </div>
                <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-bold">
                  {quoteNumber}
                </span>
              </div>

              {/* Prévia Formatada dos Dados */}
              <div className="bg-slate-950/90 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-2.5 max-h-72 overflow-y-auto whitespace-pre-wrap border border-slate-800 leading-relaxed shadow-inner">
                {generateFormattedQuoteText().text}
              </div>

              {/* Totalizador Destacado */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal ({items.length} itens):</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between text-xs text-red-400 font-semibold">
                    <span>Desconto ({discountType === 'percent' ? `${discountValue}%` : 'Fixo'}):</span>
                    <span>- {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {travelFee > 0 && (
                  <div className="flex justify-between text-xs text-blue-300">
                    <span>Taxa Deslocamento:</span>
                    <span>+ {formatCurrency(travelFee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-300">VALOR TOTAL:</span>
                  <span className="text-2xl font-black text-amber-400">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {/* Botões de Exportação / Download */}
              <div className="space-y-2 pt-2">
                
                {/* Botão WhatsApp */}
                <button
                  onClick={handleSendWhatsApp}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Enviar Orçamento no WhatsApp
                </button>

                {/* Grade de Exportação PDF / DOCX */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportPDF}
                    className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download size={15} /> Baixar PDF
                  </button>

                  <button
                    onClick={handleExportDOCX}
                    className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <FileText size={15} /> Baixar Word (.docx)
                  </button>
                </div>

                {/* Emitir Recibo de Quitação (PDF) */}
                <button
                  onClick={async () => {
                    try {
                      const quoteObj = getCurrentQuoteObject();
                      await generateReceiptPDF(quoteObj);
                      toast('Recibo de Pagamento & Quitação gerado em PDF!', 'success');
                    } catch (e) {
                      console.error(e);
                      toast('Erro ao emitir recibo em PDF.', 'error');
                    }
                  }}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Receipt size={15} /> Emitir Recibo & Quitação (PDF)
                </button>

                {/* Copiar Texto & Imprimir */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopy}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                    {copied ? 'Copiado!' : 'Copiar Texto'}
                  </button>

                  <button
                    onClick={handlePrint}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Printer size={15} /> Imprimir
                  </button>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* MODAL: Importar Arquivo (DOCX / JSON / Texto) */}
      <QuoteImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={data => loadQuoteIntoForm(data)}
      />

      {/* MODAL: Modelos Prontos por Categoria */}
      {isTemplatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Layers size={18} className="text-amber-500" /> Modelos Prontos de Orçamento
                </h3>
                <p className="text-xs text-gray-500">Selecione um modelo para preencher o orçamento instantaneamente</p>
              </div>
              <button
                onClick={() => setIsTemplatesModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {QUOTE_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    loadQuoteIntoForm({
                      title: tmpl.title,
                      category: tmpl.category,
                      items: tmpl.items.map((it, i) => ({
                        ...it,
                        id: `tmpl-${idx}-${i}`,
                        totalPrice: it.quantity * it.unitPrice,
                      })),
                      estimatedDays: tmpl.estimatedDays,
                      paymentTerms: tmpl.paymentTerms,
                      warranty: tmpl.warranty,
                    });
                    setIsTemplatesModalOpen(false);
                    toast(`Modelo "${tmpl.name}" carregado com sucesso!`, 'success');
                  }}
                  className="p-3.5 bg-gray-50 hover:bg-brand-50/60 rounded-xl border border-gray-200 hover:border-brand-300 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-900 group-hover:text-brand-700">
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 line-clamp-2">{tmpl.title}</p>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
                    <span>{tmpl.items.length} itens inclusos</span>
                    <span className="text-brand-600 font-bold group-hover:underline">Usar Modelo →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: Histórico de Orçamentos Salvos */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FolderOpen size={18} className="text-brand-600" /> Meus Orçamentos Salvos ({savedQuotes.length})
                </h3>
                <p className="text-xs text-gray-500">Acesse propostas anteriores, altere status e exporte documentos</p>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por cliente, título ou número..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />

              <select
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
              >
                <option value="all">Todos os Status</option>
                <option value="draft">Rascunhos</option>
                <option value="sent">Enviados</option>
                <option value="approved">Aprovados</option>
                <option value="completed">Concluídos</option>
                <option value="rejected">Recusados</option>
              </select>
            </div>

            {/* Lista de Orçamentos */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-2">
                  <FileSpreadsheet size={36} className="mx-auto text-gray-400" />
                  <p className="text-xs font-semibold">Nenhum orçamento encontrado.</p>
                  <p className="text-[11px] text-gray-400">Salve seu primeiro orçamento clicando em "Salvar no Histórico".</p>
                </div>
              ) : (
                filteredHistory.map(q => (
                  <div
                    key={q.id}
                    className="p-4 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{q.clientName || 'Cliente'}</span>
                        <span className="text-[10px] font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md font-semibold">
                          {q.quoteNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          q.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          q.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          q.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                          q.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {q.status === 'approved' ? 'Aprovado' :
                           q.status === 'sent' ? 'Enviado' :
                           q.status === 'completed' ? 'Concluído' :
                           q.status === 'rejected' ? 'Recusado' : 'Rascunho'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{q.title}</p>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span>Total: <strong>{formatCurrency(q.totalAmount)}</strong></span>
                        <span>•</span>
                        <span>{new Date(q.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          loadQuoteIntoForm(q);
                          setIsHistoryDrawerOpen(false);
                          toast(`Orçamento ${q.quoteNumber} carregado no formulário!`, 'success');
                        }}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg transition"
                      >
                        Carregar
                      </button>

                      <button
                        onClick={() => generateQuotePDF(q)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                        title="Baixar PDF"
                      >
                        <Download size={16} />
                      </button>

                      <button
                        onClick={() => generateQuoteDOCX(q)}
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                        title="Baixar Word (.docx)"
                      >
                        <FileText size={16} />
                      </button>

                      <button
                        onClick={() => generateReceiptPDF(q)}
                        className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition"
                        title="Emitir Recibo & Quitação (PDF)"
                      >
                        <Receipt size={16} />
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Deseja realmente excluir o orçamento ${q.quoteNumber}?`)) {
                            await store.deleteDetailedQuote(q.id);
                            await loadSavedQuotes();
                            toast('Orçamento excluído com sucesso.', 'info');
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Assinatura Digital Eletrônica */}
      <DigitalSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        signerName={signatureRole === 'provider' ? (providerName || 'Prestador') : (clientName || 'Cliente')}
        signerRole={signatureRole}
        onSave={(sigBase64, role) => {
          if (role === 'provider') {
            setProviderSignature(sigBase64);
            toast('Assinatura do Prestador salva com sucesso!', 'success');
          } else {
            setClientSignature(sigBase64);
            setSignedAt(new Date().toISOString());
            setStatus('approved');
            toast('Assinatura do Cliente salva! Orçamento marcado como Aprovado.', 'success');
          }
        }}
      />

    </div>
  );
};
