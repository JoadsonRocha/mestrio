import React, { useEffect, useState } from 'react';
import {
  Plus,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  MessageSquare,
  Check,
  X,
  Send,
  AlertCircle,
  FileText,
  Phone,
  Sparkles,
  Flame,
  Calendar,
  Image as ImageIcon,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { store } from '../services/store';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { JobRequest, QuoteProposal, UserRole } from '../types';
import { useCategories } from '../context/CategoriesContext';
import { useNavigate } from 'react-router-dom';

/**
 * Mural de Anúncios de Pedidos de Serviços (Demandas publicadas por clientes).
 * - Permite que clientes publiquem solicitações de serviço estilo anúncio de demanda.
 * - Permite que prestadores naveguem pelas oportunidades, vejam fotos/urgência e enviem propostas comerciais.
 */
export const JobRequestsTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [proposals, setProposals] = useState<QuoteProposal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros para Prestadores no Mural
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<'all' | 'urgent' | 'this_week' | 'flexible'>('all');

  // Modal Novo Pedido de Serviço (Cliente)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState<'urgent' | 'this_week' | 'flexible'>('this_week');
  const [location, setLocation] = useState(user?.location || 'São Paulo, SP');
  const [budget, setBudget] = useState('');
  const [clientPhone, setClientPhone] = useState(user?.phone || '');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'whatsapp' | 'chat' | 'phone'>('whatsapp');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isEnhancingAI, setIsEnhancingAI] = useState(false);

  // Modal Enviar Proposta (Profissional)
  const [selectedJob, setSelectedJob] = useState<JobRequest | null>(null);
  const [estPrice, setEstPrice] = useState('');
  const [estDays, setEstDays] = useState('1');
  const [quoteDesc, setQuoteDesc] = useState('');

  // Modal Preview de Foto
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const isClient = user?.role === UserRole.CLIENT;

  const loadData = async () => {
    setLoading(true);
    try {
      const allJobs = await store.getJobRequests();
      const allQuotes = await store.getQuoteProposals();

      if (isClient) {
        setRequests(allJobs.filter(j => j.clientId === user?.id));
      } else {
        // Profissionais vêem todos os pedidos abertos
        setRequests(allJobs.filter(j => j.status === 'open' || j.status === 'in_progress'));
      }
      setProposals(allQuotes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Define primeira categoria padrão
  useEffect(() => {
    if (!category && categories.length > 0) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

  // Assistência IA para detalhar a demanda
  const handleEnhanceWithAI = async () => {
    if (!title.trim() && !description.trim()) {
      toast('Digite ao menos o título ou um resumo simples para a IA aprimorar.', 'info');
      return;
    }
    setIsEnhancingAI(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'description',
          title: title || 'Serviço residencial',
          category: category || 'Geral',
          context: description || 'Preciso de um profissional experiente.'
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data && data.text) {
        setDescription(data.text);
        toast('Descrição aprimorada com sucesso pela IA!', 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Não foi possível conectar com o assistente IA no momento.', 'info');
    } finally {
      clearTimeout(timeoutId);
      setIsEnhancingAI(false);
    }
  };

  // Upload simples de foto (Data URL)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length >= 3) {
      toast('Você pode anexar no máximo 3 fotos por pedido.', 'info');
      return;
    }

    const file = files[0];
    if (file.size > 2 * 1024 * 1024) {
      toast('A foto deve ter menos de 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (base64) {
        setPhotos(prev => [...prev, base64].slice(0, 3));
        toast('Foto anexada com sucesso!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await store.createJobRequest({
        clientId: user.id,
        clientName: user.name,
        clientAvatar: user.avatar,
        clientPhone: clientPhone.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        urgency,
        photos: photos.length > 0 ? photos : undefined,
        preferredContactMethod,
        budget: budget ? Number(budget) : undefined,
      });

      toast('Pedido de serviço anunciado com sucesso no mural!', 'success');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setBudget('');
      setPhotos([]);
      loadData();
    } catch (e) {
      console.error(e);
      toast('Erro ao publicar pedido de serviço.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedJob || !estPrice || !quoteDesc.trim()) return;

    setSubmitting(true);
    try {
      await store.createQuoteProposal({
        jobRequestId: selectedJob.id,
        providerId: user.id,
        providerName: user.name,
        providerAvatar: user.avatar,
        clientId: selectedJob.clientId,
        estimatedPrice: Number(estPrice),
        estimatedDays: Number(estDays),
        description: quoteDesc.trim(),
      });
      toast('Proposta enviada ao cliente com sucesso!', 'success');
      setSelectedJob(null);
      setEstPrice('');
      setQuoteDesc('');
      loadData();
    } catch (e) {
      console.error(e);
      toast('Erro ao enviar proposta comercial.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptProposal = async (quoteId: string) => {
    try {
      await store.updateQuoteStatus(quoteId, 'accepted');
      toast('Proposta aceita! O profissional receberá a confirmação.', 'success');
      loadData();
    } catch (e) {
      toast('Erro ao aceitar proposta.', 'error');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (confirm('Deseja realmente encerrar e remover este anúncio de pedido de serviço?')) {
      try {
        await store.deleteJobRequest(jobId);
        toast('Pedido de serviço removido com sucesso.', 'success');
        loadData();
      } catch (e) {
        toast('Erro ao remover pedido.', 'error');
      }
    }
  };

  // Filtragem de pedidos para prestadores
  const filteredRequests = requests.filter(job => {
    if (selectedCategoryFilter !== 'all' && job.category !== selectedCategoryFilter) return false;
    if (selectedUrgencyFilter !== 'all' && (job.urgency || 'this_week') !== selectedUrgencyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = job.title.toLowerCase().includes(q);
      const matchDesc = job.description.toLowerCase().includes(q);
      const matchLoc = job.location.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc) return false;
    }
    return true;
  });

  const getUrgencyBadge = (u?: 'urgent' | 'this_week' | 'flexible') => {
    switch (u) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <Flame size={12} className="text-rose-600 animate-pulse" /> Urgente (Hoje/Amanhã)
          </span>
        );
      case 'flexible':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            <Clock size={12} className="text-gray-500" /> Sem Pressa / Flexível
          </span>
        );
      case 'this_week':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Calendar size={12} className="text-amber-600" /> Esta semana
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
        <p className="text-xs text-gray-500">Carregando pedidos de serviços...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-brand-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold uppercase tracking-wider mb-2 border border-white/15">
              <Briefcase size={13} className="text-amber-300" />
              {isClient ? 'Área do Cliente' : 'Mural de Oportunidades'}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {isClient ? 'Meus Pedidos de Serviços Anunciados' : 'Mural de Pedidos de Clientes'}
            </h1>
            <p className="text-xs sm:text-sm text-brand-100/90 mt-1 max-w-2xl leading-relaxed">
              {isClient
                ? 'Anuncie o que você precisa resolver. Os prestadores qualificados da sua região visualizam seu pedido e enviam orçamentos rápidos.'
                : 'Demandas reais anunciadas por clientes que precisam de atendimento. Analise os detalhes e envie sua proposta comercial.'}
            </p>
          </div>

          {isClient && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center px-5 py-3 bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shrink-0 active:scale-95"
            >
              <Plus size={18} className="mr-1.5" /> Anunciar Pedido de Serviço
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca & Filtros (Para Prestadores) */}
      {!isClient && (
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por serviço, problema ou bairro..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-gray-50/50"
              />
            </div>

            {/* Filtro por Categoria */}
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="w-full sm:w-48 py-2 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50/50 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="all">Todas as categorias</option>
              {categories.map(c => (
                <option key={c.slug} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Filtro por Urgência */}
            <select
              value={selectedUrgencyFilter}
              onChange={e => setSelectedUrgencyFilter(e.target.value as any)}
              className="w-full sm:w-48 py-2 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50/50 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="all">Todas as urgências</option>
              <option value="urgent">🔥 Urgentes (Hoje/Amanhã)</option>
              <option value="this_week">📅 Esta semana</option>
              <option value="flexible">⏳ Flexível</option>
            </select>
          </div>
        </div>
      )}

      {/* Lista de Anúncios de Pedidos de Serviço */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 p-10 text-center space-y-3">
          <div className="w-14 h-14 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
            <Briefcase size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-900">
            {isClient ? 'Nenhum pedido de serviço anunciado ainda' : 'Nenhuma demanda encontrada no momento'}
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            {isClient
              ? 'Precisa de reparo elétrico, hidráulico, pintura ou limpeza? Publique seu pedido em 1 minuto e receba propostas dos melhores profissionais.'
              : 'Novos clientes publicam pedidos de serviço constantemente. Fique atento a novas oportunidades ou ajuste os filtros acima.'}
          </p>
          {isClient && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              <Plus size={16} className="mr-1.5" /> Publicar Meu Primeiro Pedido
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRequests.map(job => {
            const jobQuotes = proposals.filter(p => p.jobRequestId === job.id);
            const userProposal = proposals.find(p => p.jobRequestId === job.id && p.providerId === user?.id);

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-gray-200/80 hover:border-brand-300 shadow-2xs hover:shadow-xs transition p-5 space-y-4"
              >
                {/* Header do Card de Demanda */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                        {job.category}
                      </span>
                      {getUrgencyBadge(job.urgency)}
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                          job.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {job.status === 'open' ? '🟢 Aberto a Propostas' : 'Concluído'}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                      {job.title}
                    </h2>

                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center">
                        <MapPin size={13} className="mr-1 text-brand-600" /> {job.location}
                      </span>
                      <span>•</span>
                      <span>Anunciado por <strong>{job.clientName}</strong></span>
                      <span>•</span>
                      <span>{new Date(job.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Orçamento Previsto */}
                  <div className="bg-gray-50 border border-gray-200/70 p-2.5 rounded-xl text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">
                      Orçamento Estimado
                    </span>
                    <span className="text-base font-extrabold text-gray-900">
                      {job.budget ? `R$ ${job.budget.toLocaleString('pt-BR')}` : 'A Combinar'}
                    </span>
                  </div>
                </div>

                {/* Descrição Detalhada */}
                <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50/40 p-3 rounded-xl border border-gray-100">
                  {job.description}
                </div>

                {/* Galeria de Fotos Anexadas pelo Cliente */}
                {job.photos && job.photos.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-gray-600 block mb-1.5 flex items-center gap-1">
                      <ImageIcon size={13} className="text-brand-600" /> Fotos do local / problema ({job.photos.length})
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {job.photos.map((ph, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewPhoto(ph)}
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 hover:border-brand-500 transition shrink-0 group"
                        >
                          <img src={ph} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                            Ver
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SEÇÃO DO CLIENTE: Propostas Recebidas */}
                {isClient && (
                  <div className="bg-brand-50/50 rounded-xl p-4 border border-brand-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <MessageSquare size={15} className="text-brand-600" />
                        Propostas Recebidas ({jobQuotes.length})
                      </h3>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Trash2 size={13} /> Encerrar Pedido
                      </button>
                    </div>

                    {jobQuotes.length === 0 ? (
                      <p className="text-xs text-gray-500 italic bg-white p-3 rounded-lg border border-gray-200">
                        Aguardando propostas dos prestadores. Notificaremos você assim que um profissional responder ao seu anúncio!
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {jobQuotes.map(q => (
                          <div
                            key={q.id}
                            className="bg-white p-3.5 rounded-xl border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-gray-900">{q.providerName}</span>
                                <span className="text-xs font-extrabold text-emerald-600">
                                  R$ {q.estimatedPrice.toLocaleString('pt-BR')}
                                </span>
                                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  Prazo: {q.estimatedDays} {q.estimatedDays === 1 ? 'dia' : 'dias'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600">{q.description}</p>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {q.status === 'accepted' ? (
                                <span className="inline-flex items-center text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                  <Check size={14} className="mr-1" /> Proposta Aceita
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAcceptProposal(q.id)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-2xs"
                                >
                                  Aceitar Proposta
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SEÇÃO DO PRESTADOR: Contato Rápido & Envio de Proposta */}
                {!isClient && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    {/* Contato do Cliente */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.clientPhone ? (
                        <a
                          href={`https://wa.me/55${job.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${job.clientName}, vi seu pedido de serviço "${job.title}" no Mestrio e gostaria de conversar sobre!`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold transition shadow-2xs"
                        >
                          <Phone size={14} className="text-emerald-600" /> WhatsApp Direto: {job.clientPhone}
                        </a>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 text-gray-700 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-brand-600" /> Contato via Chat Mestrio
                        </div>
                      )}
                    </div>

                    {/* Botão de Enviar Proposta */}
                    <div>
                      {userProposal ? (
                        <div className="bg-brand-50 border border-brand-200 text-brand-800 text-xs px-3.5 py-2 rounded-xl flex items-center font-semibold">
                          <Check size={14} className="mr-1.5 text-brand-600 shrink-0" />
                          <span>Proposta enviada: <strong>R$ {userProposal.estimatedPrice}</strong></span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!user) { navigate('/login'); return; }
                            setSelectedJob(job);
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Send size={14} /> Enviar Proposta Comercial
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Publicar Anúncio de Pedido de Serviço (Cliente) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                  <Briefcase size={18} className="text-brand-600" /> Anunciar Pedido de Serviço
                </h3>
                <p className="text-xs text-gray-500">Descreva o que precisa e receba orçamentos de profissionais</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              {/* Título do Anúncio */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Título do Serviço Solicitado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de fiação de chuveiro ou Pintura de sala 30m²"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-medium"
                />
              </div>

              {/* Categoria & Urgência */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Categoria *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.slug} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Urgência do Serviço</label>
                  <select
                    value={urgency}
                    onChange={e => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-medium"
                  >
                    <option value="urgent">🔥 Urgente (Hoje/Amanhã)</option>
                    <option value="this_week">📅 Esta semana</option>
                    <option value="flexible">⏳ Flexível / A combinar</option>
                  </select>
                </div>
              </div>

              {/* Local & Orçamento Estimado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Local / Bairro do Atendimento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pinheiros, São Paulo - SP"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Orçamento Estimado (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 300 (opcional)"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Telefone / WhatsApp para contato direto */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">WhatsApp para Contato Direto (Opcional)</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-500 mt-0.5 block">Permite que o prestador mande mensagem diretamente para agilizar.</span>
              </div>

              {/* Descrição Detalhada com IA */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-800">
                    Descrição Detalhada do Pedido *
                  </label>
                  <button
                    type="button"
                    onClick={handleEnhanceWithAI}
                    disabled={isEnhancingAI}
                    className="text-[11px] text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    {isEnhancingAI ? 'Aprimorando...' : 'Melhorar com IA'}
                  </button>
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder="Explique os detalhes do trabalho, metragem, tipo de material disponível e horário de preferência."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Anexo de Fotos do Local / Problema */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Fotos do Local ou Problema (Máx. 3 fotos)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {photos.map((ph, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-300">
                      <img src={ph} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-rose-600 transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {photos.length < 3 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-500 flex flex-col items-center justify-center cursor-pointer transition text-gray-400 hover:text-brand-600 bg-gray-50">
                      <ImageIcon size={18} />
                      <span className="text-[9px] font-bold mt-1">+ Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? 'Publicando...' : 'Publicar Anúncio de Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Enviar Proposta Comercial (Profissional) */}
      {/* ========================================================================= */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-gray-900 text-base">Enviar Proposta Comercial</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-brand-50 p-3 rounded-xl border border-brand-100 text-xs space-y-1">
              <span className="font-bold text-brand-900 block">{selectedJob.title}</span>
              <span className="text-brand-700">Cliente: {selectedJob.clientName} • {selectedJob.location}</span>
            </div>

            <form onSubmit={handleSendProposal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Valor da Proposta (R$) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 350"
                    value={estPrice}
                    onChange={e => setEstPrice(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Prazo Estimado (Dias) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={estDays}
                    onChange={e => setEstDays(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Detalhamento da Proposta *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explique o que está incluído no seu atendimento, disponibilidade de início e garantia técnica."
                  value={quoteDesc}
                  onChange={e => setQuoteDesc(e.target.value)}
                  className="w-full p-3 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? 'Enviando...' : 'Enviar Proposta Comercial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visualizar Foto em Tela Cheia */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden bg-black" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-rose-600 transition"
            >
              <X size={18} />
            </button>
            <img src={previewPhoto} alt="Foto ampliada" className="w-full h-auto max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

    </div>
  );
};
