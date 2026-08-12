import React, { useEffect, useState } from 'react';
import { Plus, Briefcase, MapPin, DollarSign, Clock, MessageSquare, Check, X, Send, AlertCircle, FileText } from 'lucide-react';
import { store } from '../services/store';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { JobRequest, QuoteProposal, UserRole } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';

export const JobRequestsTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [proposals, setProposals] = useState<QuoteProposal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Novo Pedido de Orçamento (Cliente)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]?.name || 'Geral');
  const [location, setLocation] = useState(user?.location || 'São Paulo, SP');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal Enviar Proposta (Profissional)
  const [selectedJob, setSelectedJob] = useState<JobRequest | null>(null);
  const [estPrice, setEstPrice] = useState('');
  const [estDays, setEstDays] = useState('1');
  const [quoteDesc, setQuoteDesc] = useState('');

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
        setRequests(allJobs.filter(j => j.status === 'open'));
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

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await store.createJobRequest({
        clientId: user.id,
        clientName: user.name,
        clientAvatar: user.avatar,
        title,
        description,
        category,
        location,
        budget: budget ? Number(budget) : undefined,
      });
      toast('Solicitação de orçamento criada com sucesso!', 'success');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setBudget('');
      loadData();
    } catch (e) {
      console.error(e);
      toast('Erro ao criar solicitação.', 'error');
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
        description: quoteDesc,
      });
      toast('Proposta enviada ao cliente com sucesso!', 'success');
      setSelectedJob(null);
      setEstPrice('');
      setQuoteDesc('');
      loadData();
    } catch (e) {
      console.error(e);
      toast('Erro ao enviar proposta.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptProposal = async (quoteId: string) => {
    try {
      await store.updateQuoteStatus(quoteId, 'accepted');
      toast('Proposta aceita! O profissional foi notificado.', 'success');
      loadData();
    } catch (e) {
      toast('Erro ao aceitar proposta.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Briefcase size={20} className="text-brand-600 mr-2" />
            {isClient ? 'Minhas Solicitações de Orçamento' : 'Oportunidades de Orçamento'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isClient
              ? 'Descreva o serviço que precisa e receba orçamentos diretamente dos melhores profissionais.'
              : 'Veja solicitações publicadas por clientes e envie suas propostas comerciais.'}
          </p>
        </div>

        {isClient && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white font-medium text-sm rounded-lg hover:bg-brand-700 transition shrink-0"
          >
            <Plus size={16} className="mr-1.5" /> Nova Solicitação
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <FileText size={36} className="text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">
            {isClient ? 'Nenhuma solicitação publicada' : 'Nenhuma oportunidade disponível no momento'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {isClient
              ? 'Clique no botão acima para pedir orçamentos detalhados para o seu projeto.'
              : 'Fique atento! Novas solicitações de clientes aparecem aqui diariamente.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map(job => {
            const jobQuotes = proposals.filter(p => p.jobRequestId === job.id);
            const userProposal = proposals.find(p => p.jobRequestId === job.id && p.providerId === user?.id);

            return (
              <div key={job.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                        {job.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        job.status === 'open' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {job.status === 'open' ? 'Aberto' : 'Concluído'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">{job.title}</h3>
                    <p className="text-xs text-gray-500 flex items-center mt-1">
                      <MapPin size={12} className="mr-1" /> {job.location} • Criado em {new Date(job.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {job.budget && (
                    <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg text-right shrink-0">
                      <span className="text-[10px] text-gray-400 block uppercase">Orçamento Estimado</span>
                      <span className="text-sm font-bold text-gray-900">R$ {job.budget.toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-600 whitespace-pre-line">{job.description}</p>

                {/* Se for Cliente: Lista de Propostas Recebidas */}
                {isClient && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 flex items-center">
                      <MessageSquare size={14} className="mr-1.5 text-brand-600" />
                      Propostas Recebidas ({jobQuotes.length})
                    </h4>

                    {jobQuotes.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Aguardando propostas de profissionais qualificados...</p>
                    ) : (
                      <div className="space-y-2">
                        {jobQuotes.map(q => (
                          <div key={q.id} className="bg-white p-3 rounded-md border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-gray-900">{q.providerName}</span>
                                <span className="text-xs font-bold text-green-600">R$ {q.estimatedPrice.toLocaleString('pt-BR')}</span>
                                <span className="text-[11px] text-gray-500">({q.estimatedDays} {q.estimatedDays === 1 ? 'dia' : 'dias'})</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{q.description}</p>
                            </div>

                            {q.status === 'accepted' ? (
                              <span className="inline-flex items-center text-xs text-green-700 font-semibold bg-green-50 px-2 py-1 rounded">
                                <Check size={14} className="mr-1" /> Proposta Aceita
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcceptProposal(q.id)}
                                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition"
                              >
                                Aceitar Proposta
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Se for Profissional: Enviar Proposta */}
                {!isClient && (
                  <div className="flex items-center justify-between pt-2">
                    {userProposal ? (
                      <div className="bg-brand-50 border border-brand-200 text-brand-800 text-xs px-3 py-2 rounded-lg flex items-center w-full">
                        <Check size={14} className="mr-2 text-brand-600 shrink-0" />
                        <span>Sua proposta de <strong>R$ {userProposal.estimatedPrice}</strong> foi enviada em {new Date(userProposal.createdAt).toLocaleDateString('pt-BR')}.</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition inline-flex items-center"
                      >
                        <Send size={14} className="mr-1.5" /> Enviar Proposta de Orçamento
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar Solicitação (Cliente) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">Solicitar Orçamento de Serviço</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Título do Pedido *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de fiação de chuveiro ou Pintura de sala"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Categoria *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {DEFAULT_CATEGORIES.map(c => (
                      <option key={c.slug} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Orçamento Estimado (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 350"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Local do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Cidade, Bairro ou Estado"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição Detalhada *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Descreva exatamente o que precisa ser feito, restrições e prazo desejado."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Publicando...' : 'Publicar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Enviar Proposta (Profissional) */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">Enviar Proposta de Orçamento</h3>
              <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-brand-50 p-3 rounded-lg border border-brand-100 text-xs">
              <span className="font-semibold text-brand-900 block">{selectedJob.title}</span>
              <span className="text-brand-700">Cliente: {selectedJob.clientName} ({selectedJob.location})</span>
            </div>

            <form onSubmit={handleSendProposal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Valor da Proposta (R$) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 400"
                    value={estPrice}
                    onChange={e => setEstPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prazo Estimado (Dias) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={estDays}
                    onChange={e => setEstDays(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Detalhamento da Proposta *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explique o que está incluído no seu serviço, materiais e garantias fornecidas."
                  value={quoteDesc}
                  onChange={e => setQuoteDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar Proposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
