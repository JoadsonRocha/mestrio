import React, { useEffect, useState } from 'react';
import { store } from '../services/store';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, MessageSquare, Calendar, Star, CheckCircle2, Megaphone, Mail,
  Briefcase, X, Clock, DollarSign, Heart, TrendingUp, Bell, ArrowRight,
  ShieldCheck, MapPin, Share2, Award, QrCode, ExternalLink, Calculator,
  Sparkles, Flame, Check, Phone, FileText, ChevronRight, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCategories } from '../context/CategoriesContext';
import { ServiceAd, UserRole, Appointment, AppointmentStatus, ChatSession, SystemBroadcast, JobRequest, DetailedQuote } from '../types';
import { ProfessionalScheduleModal } from '../components/ProfessionalScheduleModal';
import { ProfessionalOnboardingModal } from '../components/ProfessionalOnboardingModal';
import { ProfileCompletionWidget } from '../components/ProfileCompletionWidget';
import { DigitalBusinessCardModal } from '../components/DigitalBusinessCardModal';
import { categoryIcon } from '../components/CategoryIcon';
import { Link as RouterLink } from 'react-router-dom';
import { VerifiedBadge } from '../components/VerifiedBadge';

const DashboardHome: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [myAds, setMyAds] = useState<ServiceAd[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [broadcasts, setBroadcasts] = useState<SystemBroadcast[]>([]);
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [quotes, setQuotes] = useState<DetailedQuote[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBusinessCardModal, setShowBusinessCardModal] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'onboarding' | 'request_provider' | 'request_verification'>('onboarding');

  useEffect(() => {
    if (user && user.role === UserRole.PROVIDER && !user.hasCompletedOnboarding) {
      setOnboardingMode('onboarding');
      setOnboardingModalOpen(true);
    }
  }, [user]);

  const handleRequestProvider = async () => {
    setRequesting(true);
    try {
      await store.requestProviderRole();
      await refreshUser();
      toast('Solicitação enviada! Aguardando aprovação.', 'success');
    } catch (e: any) {
      console.error(e);
      toast(e?.message || 'Erro ao solicitar.', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleCancelProviderRequest = async () => {
    setRequesting(true);
    try {
      await store.cancelProviderRequest();
      await refreshUser();
      toast('Solicitação cancelada.', 'info');
    } catch (e) {
      console.error(e);
      toast('Erro ao cancelar.', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const loadAll = async () => {
    if (!user) return;
    try {
      const userAppointments = await store.getMyAppointments(user.id, user.role);
      setAppointments(userAppointments);

      const userChats = await store.getChats(user.id);
      setChats(userChats);

      const bcs = await store.getSystemBroadcasts();
      setBroadcasts(bcs.filter(b => b.active && (b.targetRole === 'ALL' || b.targetRole === user.role)));

      const requests = await store.getJobRequests();
      setJobRequests(requests);

      if (user.role === UserRole.PROVIDER) {
        const ads = await store.getAds({ providerId: user.id });
        setMyAds(ads);

        const savedQuotes = await store.getDetailedQuotes(user.id);
        setQuotes(savedQuotes);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    loadAll();
  }, [user, loading, navigate]);

  const handleUpdateAppStatus = async (appId: string, status: AppointmentStatus) => {
    try {
      await store.updateAppointmentStatus(appId, status);
      toast(`Atendimento marcado como ${status === 'confirmed' ? 'confirmado' : status === 'completed' ? 'concluído' : 'cancelado'}!`, 'success');
      loadAll();
    } catch (e) {
      console.error(e);
      toast('Erro ao atualizar status do atendimento.', 'error');
    }
  };

  if (loading || !user) return null;

  const isClient = user.role === UserRole.CLIENT;

  // Métricas de Desempenho e Faturamento do Profissional
  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const upcomingAppointments = appointments
    .filter(a => a.status === 'confirmed' || a.status === 'pending')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextAppointment = upcomingAppointments[0];

  const avgAdPrice = myAds.length ? (myAds.reduce((acc, a) => acc + (a.price || 0), 0) / myAds.length) : 150;
  
  // Faturamento Real: Agendamentos concluídos + Orçamentos Aprovados/Pagos
  const approvedQuotes = quotes.filter(q => q.status === 'approved' || q.status === 'completed');
  const quotesTotalValue = approvedQuotes.reduce((acc, q) => acc + (q.totalAmount || 0), 0);
  const appointmentTotalValue = completedAppointments.length * avgAdPrice;
  const totalEarned = quotesTotalValue > 0 ? (quotesTotalValue + appointmentTotalValue) : appointmentTotalValue;

  const totalViews = myAds.reduce((acc, a) => acc + (a.views || 0), 0);

  const adsTotal = myAds.length;
  const adsApproved = myAds.filter(a => a.status === 'approved').length;
  const adsPending = myAds.filter(a => a.status === 'pending').length;
  const adsRating = myAds.length ? (myAds.reduce((acc, a) => acc + (a.rating || 0), 0) / myAds.length).toFixed(1) : '0';

  const unreadMessagesCount = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Orçamentos criados pelo Cliente
  const myJobRequests = jobRequests.filter(r => r.clientId === user.id);
  // Oportunidades para o Profissional
  const openJobRequests = jobRequests.filter(r => r.status === 'open');

  const StatCard: React.FC<{ label: string; value: number | string; icon: React.ComponentType<{ size?: number | string; className?: string }>; color: string; subtext?: string }> = ({ label, value, icon: Icon, color, subtext }) => (
    <div className="bg-white rounded-2xl shadow-2xs border border-gray-100 p-4 flex items-center justify-between">
      <div className="flex items-center">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mr-3.5 ${color} shadow-2xs`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-gray-900 leading-tight tracking-tight">{value}</p>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
        </div>
      </div>
      {subtext && (
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          {subtext}
        </span>
      )}
    </div>
  );

  return (
    <div className="h-full space-y-6 pb-6 overflow-y-auto pr-1">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {isClient ? `Olá, ${user.name} 👋` : `Painel do Profissional 👋`}
            </h1>
            {user.isCertified && (
              <VerifiedBadge showText text="Profissional Verificado" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isClient
              ? 'Gerencie seus atendimentos e solicite orçamentos para profissionais da sua região.'
              : `Acompanhe seu faturamento, agenda do dia, pedidos de clientes e emita orçamentos.`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isClient ? (
            <>
              <RouterLink
                to="/search"
                className="bg-gray-100 text-gray-700 px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center hover:bg-gray-200 transition"
              >
                <Search size={14} className="mr-1.5 text-brand-600" /> Buscar Serviços
              </RouterLink>
              <RouterLink
                to="/dashboard/job-requests"
                className="bg-brand-600 text-white px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center hover:bg-brand-700 transition shadow-sm"
              >
                <Plus size={14} className="mr-1.5" /> Solicitar Serviço
              </RouterLink>
            </>
          ) : (
            <>
              {!user.isCertified && (
                <button
                  onClick={() => {
                    setOnboardingMode('request_verification');
                    setOnboardingModalOpen(true);
                  }}
                  className="bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-2 text-xs font-bold rounded-xl flex items-center hover:bg-blue-100 transition shadow-2xs"
                >
                  <ShieldCheck size={14} className="mr-1.5 text-blue-600" /> Solicitar Selo
                </button>
              )}
              <button
                onClick={() => setShowScheduleModal(true)}
                className="bg-gray-100 text-gray-700 px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center hover:bg-gray-200 transition"
              >
                <Clock size={14} className="mr-1.5 text-brand-600" /> Horários
              </button>
              <RouterLink
                to="/dashboard/quote-builder"
                className="bg-brand-600 text-white px-3.5 py-2 text-xs font-bold rounded-xl flex items-center hover:bg-brand-700 transition shadow-sm"
              >
                <Calculator size={14} className="mr-1.5" /> Gerar Orçamento
              </RouterLink>
            </>
          )}
        </div>
      </div>

      {/* Broadcasts / Avisos Globais do Sistema */}
      {broadcasts.map(b => (
        <div key={b.id} className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <Bell size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-blue-900 text-sm">{b.title}</h4>
            <p className="text-xs text-blue-700 mt-0.5">{b.message}</p>
          </div>
        </div>
      ))}

      {/* ========================================================================= */}
      {/* JORNADA DO CLIENTE */}
      {/* ========================================================================= */}
      {isClient && (
        <div className="space-y-6">
          {/* Card em Destaque: Próximo Atendimento */}
          {nextAppointment ? (
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
                <Calendar size={220} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="bg-white/20 text-white text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                  Próximo Agendamento
                </span>
                <span className="text-xs text-brand-100 font-medium flex items-center">
                  <Clock size={14} className="mr-1" />
                  {new Date(nextAppointment.date).toLocaleDateString('pt-BR')} às {nextAppointment.time}
                </span>
              </div>

              <h3 className="text-xl font-extrabold mb-1">{nextAppointment.adTitle || 'Atendimento Agendado'}</h3>
              <p className="text-xs text-brand-100 mb-4 flex items-center">
                <ShieldCheck size={14} className="mr-1" /> Prestador: {nextAppointment.providerName || 'Profissional Mestrio'}
              </p>

              <div className="flex items-center gap-3 pt-2">
                <RouterLink
                  to={`/dashboard/chat`}
                  className="bg-white text-brand-700 hover:bg-brand-50 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center shadow-sm"
                >
                  <MessageSquare size={14} className="mr-1.5" /> Conversar no Chat
                </RouterLink>
                <RouterLink
                  to="/dashboard/appointments"
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold transition backdrop-blur-sm"
                >
                  Ver Todos
                </RouterLink>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search size={22} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Que serviço você precisa hoje?</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mb-5">
                Encontre profissionais verificados perto de você para reformas, manutenção, pintura e muito mais.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {categories.slice(0, 4).map(cat => (
                  <RouterLink
                    key={cat.slug}
                    to={`/search?category=${cat.slug}`}
                    className="p-3 rounded-xl border border-gray-100 hover:border-brand-300 hover:shadow-sm transition flex flex-col items-center group bg-gray-50/50"
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-2 transition group-hover:scale-110">
                      {categoryIcon(cat.icon, 18)}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 group-hover:text-brand-600">{cat.name}</span>
                  </RouterLink>
                ))}
              </div>
            </div>
          )}

          {/* Cards Rápidos de Navegação do Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Mensagens Não Lidas" value={unreadMessagesCount} icon={MessageSquare} color="bg-green-50 text-green-600" />
            <StatCard label="Agendamentos Ativos" value={upcomingAppointments.length} icon={Calendar} color="bg-blue-50 text-blue-600" />
            <StatCard label="Serviços Solicitados" value={myJobRequests.length} icon={Briefcase} color="bg-purple-50 text-purple-600" />
          </div>

          {/* Minhas Solicitações de Serviços */}
          {myJobRequests.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center">
                  <Briefcase size={18} className="mr-2 text-brand-600" /> Meus Pedidos de Serviços Anunciados
                </h3>
                <RouterLink to="/dashboard/job-requests" className="text-xs text-brand-600 font-semibold hover:underline flex items-center">
                  Ver todos <ArrowRight size={12} className="ml-1" />
                </RouterLink>
              </div>

              <div className="divide-y divide-gray-100">
                {myJobRequests.slice(0, 3).map(req => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{req.title}</p>
                      <p className="text-xs text-gray-500">{req.category} · {req.location || 'Sua Cidade'}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-green-50 text-green-700 border border-green-200">
                      {req.proposalsCount || 0} propostas
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solicitar Papel de Profissional */}
          {user.roleRequest === 'PROVIDER' ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Briefcase size={20} className="text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-800 text-sm">Solicitação de profissional enviada</p>
                <p className="text-xs text-yellow-700">Assim que a administração aprovar, você poderá criar anúncios de serviços.</p>
              </div>
              <button
                onClick={handleCancelProviderRequest}
                disabled={requesting}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50 flex items-center"
              >
                <X size={12} className="mr-1" /> Cancelar solicitação
              </button>
            </div>
          ) : (
            <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                  <Briefcase size={20} />
                </div>
                <div>
                  <p className="font-bold text-brand-900 text-sm">Você presta serviços?</p>
                  <p className="text-xs text-brand-700">Torne-se um profissional verificado e receba pedidos de clientes da sua região.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOnboardingMode('request_provider');
                  setOnboardingModalOpen(true);
                }}
                disabled={requesting}
                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition shadow-sm disabled:opacity-50 shrink-0"
              >
                Quero ser Profissional
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* JORNADA DO PROFISSIONAL (HUB ESTRATÉGICO) */}
      {/* ========================================================================= */}
      {!isClient && (
        <div className="space-y-6">
          {/* Widget de Conclusão de Perfil */}
          <ProfileCompletionWidget
            user={user}
            ads={myAds}
            onOpenKYC={() => {
              setOnboardingMode('request_verification');
              setOnboardingModalOpen(true);
            }}
          />

          {/* HUB DE AÇÕES RÁPIDAS (PRODUTIVIDADE DO PRESTADOR) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center">
                <Zap size={18} className="text-brand-600 mr-2" /> Ações Rápidas de Trabalho
              </h2>
              <span className="text-xs text-gray-400">Atalhos principais</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Criar Orçamento IA */}
              <RouterLink
                to="/dashboard/quote-builder"
                className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 hover:from-blue-100 hover:to-indigo-100/70 border border-blue-200/80 p-4 rounded-2xl transition shadow-2xs group flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                  <Calculator size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 block group-hover:text-blue-700">Novo Orçamento IA</span>
                  <span className="text-[11px] text-gray-500 font-medium">Gerar PDF, DOCX e Recibos</span>
                </div>
              </RouterLink>

              {/* 2. Criar Anúncio */}
              <RouterLink
                to="/create-ad"
                className="bg-white hover:bg-amber-50/40 border border-gray-200/80 p-4 rounded-2xl transition shadow-2xs group flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Megaphone size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 block group-hover:text-amber-700">Anunciar Serviço</span>
                  <span className="text-[11px] text-gray-500 font-medium">Publicar nova especialidade</span>
                </div>
              </RouterLink>

              {/* 3. Cartão de Visitas Digital */}
              <button
                onClick={() => setShowBusinessCardModal(true)}
                className="bg-white hover:bg-purple-50/40 border border-gray-200/80 p-4 rounded-2xl transition shadow-2xs group flex flex-col justify-between text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <QrCode size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 block group-hover:text-purple-700">Cartão Digital QR</span>
                  <span className="text-[11px] text-gray-500 font-medium">Compartilhar no WhatsApp</span>
                </div>
              </button>

              {/* 4. Perfil Público */}
              <RouterLink
                to={`/profissional/${user.id}`}
                className="bg-white hover:bg-emerald-50/40 border border-gray-200/80 p-4 rounded-2xl transition shadow-2xs group flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ExternalLink size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 block group-hover:text-emerald-700">Perfil Público</span>
                  <span className="text-[11px] text-gray-500 font-medium">Visualizar como os clientes vêem</span>
                </div>
              </RouterLink>
            </div>
          </div>

          {/* Faturamento e Desempenho */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center">
                <DollarSign size={18} className="text-emerald-600 mr-1.5" /> Faturamento e Desempenho
              </h2>
              <span className="text-xs text-gray-400">Métricas consolidadas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Faturamento Real / Estimado"
                value={`R$ ${totalEarned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                color="bg-emerald-50 text-emerald-600"
                subtext={approvedQuotes.length > 0 ? `${approvedQuotes.length} orçamentos` : undefined}
              />
              <StatCard
                label="Atendimentos Concluídos"
                value={completedAppointments.length}
                icon={CheckCircle2}
                color="bg-blue-50 text-blue-600"
              />
              <StatCard
                label="Visualizações nos Anúncios"
                value={totalViews}
                icon={TrendingUp}
                color="bg-purple-50 text-purple-600"
              />
              <StatCard
                label="Orçamentos Gerados"
                value={quotes.length}
                icon={Calculator}
                color="bg-amber-50 text-amber-600"
              />
            </div>
          </div>

          {/* OPORTUNIDADES DO MURAL DE PEDIDOS (DEMANDAS DOS CLIENTES) */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                  <Flame size={18} className="text-orange-500 fill-orange-500" />
                  <span>Oportunidades em Aberto no Mural ({openJobRequests.length})</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Clientes procurando profissionais agora</p>
              </div>
              <RouterLink
                to="/dashboard/job-requests"
                className="text-xs text-brand-600 font-bold hover:text-brand-700 hover:underline flex items-center"
              >
                Ver Mural Completo <ArrowRight size={14} className="ml-1" />
              </RouterLink>
            </div>

            {openJobRequests.length === 0 ? (
              <div className="py-8 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                <Briefcase size={28} className="mx-auto text-gray-400 mb-2 opacity-60" />
                <p className="text-xs text-gray-500 font-medium">Nenhum pedido de serviço aberto no momento.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Novas solicitações de clientes da sua região aparecerão aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {openJobRequests.slice(0, 2).map(req => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-gray-200/80 hover:border-brand-300 hover:shadow-2xs transition-all flex flex-col justify-between bg-gradient-to-b from-white to-gray-50/30"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {req.category}
                        </span>
                        {req.urgency === 'urgent' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <Flame size={10} className="text-rose-600" /> Urgente
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 line-clamp-1 mb-1">{req.title}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">{req.description}</p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-xs text-gray-500 flex items-center">
                        <MapPin size={13} className="mr-1 text-gray-400" /> {req.location || 'Local a combinar'}
                      </div>
                      <RouterLink
                        to="/dashboard/job-requests"
                        className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center shadow-2xs"
                      >
                        Enviar Proposta
                      </RouterLink>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Próximos Atendimentos (Agenda do Profissional com Ações Rápidas) */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base flex items-center">
                  <Calendar size={18} className="mr-2 text-brand-600" /> Próximos Atendimentos Agendados
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Confirme ou conclua seus serviços com facilidade</p>
              </div>
              <RouterLink to="/dashboard/appointments" className="text-xs text-brand-600 font-bold hover:underline flex items-center">
                Ver todos <ArrowRight size={12} className="ml-1" />
              </RouterLink>
            </div>

            {upcomingAppointments.length === 0 ? (
              <div className="py-8 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                <Calendar size={28} className="mx-auto text-gray-400 mb-2 opacity-60" />
                <p className="text-xs text-gray-500 font-medium">Nenhum atendimento agendado para os próximos dias.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Seus clientes podem agendar através dos seus anúncios ativos.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {upcomingAppointments.slice(0, 3).map(app => (
                  <div key={app.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          app.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {app.status === 'confirmed' ? 'Confirmado' : 'Pendente de Confirmação'}
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {new Date(app.date).toLocaleDateString('pt-BR')} às {app.time}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm">{app.adTitle || 'Atendimento de Serviço'}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center">
                        <span className="font-semibold text-gray-700 mr-1.5">Cliente: {app.clientName || 'Cliente'}</span>
                        {app.clientLocation && <span>· {app.clientLocation}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {app.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateAppStatus(app.id, 'confirmed')}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center shadow-2xs"
                        >
                          <Check size={13} className="mr-1" /> Confirmar
                        </button>
                      )}

                      {app.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateAppStatus(app.id, 'completed')}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center shadow-2xs"
                        >
                          <CheckCircle2 size={13} className="mr-1" /> Concluir Serviço
                        </button>
                      )}

                      <RouterLink
                        to="/dashboard/chat"
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center transition"
                      >
                        <MessageSquare size={13} className="mr-1 text-brand-600" /> Chat
                      </RouterLink>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saúde dos Anúncios & Dica de Conversão */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Saúde dos Anúncios */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-gray-900 text-base flex items-center">
                  <Megaphone size={18} className="mr-2 text-brand-600" /> Meus Anúncios ({adsTotal})
                </h3>
                <RouterLink to="/dashboard/ads" className="text-xs text-brand-600 font-bold hover:underline flex items-center">
                  Gerenciar <ArrowRight size={12} className="ml-1" />
                </RouterLink>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Ativos" value={adsApproved} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
                <StatCard label="Em Análise" value={adsPending} icon={Clock} color="bg-amber-50 text-amber-600" />
                <StatCard label="Avaliação Média" value={adsRating} icon={Star} color="bg-purple-50 text-purple-600" />
                <StatCard label="Total Anúncios" value={adsTotal} icon={Megaphone} color="bg-brand-50 text-brand-600" />
              </div>
            </div>

            {/* Dica de Conversão & Reputação */}
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-amber-300" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">Dica do Mestrio</span>
                </div>
                <h4 className="text-sm font-bold leading-snug mb-2">Feche mais serviços com Orçamentos Profissionais</h4>
                <p className="text-xs text-brand-100 leading-relaxed">
                  Envie orçamentos em PDF com sua assinatura digital e chave PIX. Clientes valorizam clareza e transparência.
                </p>
              </div>

              <div className="pt-4 mt-2 border-t border-white/15 flex items-center justify-between">
                <span className="text-[11px] text-brand-200">Gere orçamentos em 1 minuto</span>
                <RouterLink
                  to="/dashboard/quote-builder"
                  className="bg-white text-brand-700 hover:bg-brand-50 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center"
                >
                  Criar Agora →
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Disponibilidade */}
      <ProfessionalScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
      />

      {/* Modal de Informações Profissionais & Verificação */}
      <ProfessionalOnboardingModal
        isOpen={onboardingModalOpen}
        onClose={() => setOnboardingModalOpen(false)}
        mode={onboardingMode}
        closable={onboardingMode !== 'onboarding'}
        onSuccess={() => refreshUser()}
      />

      {/* Modal de Cartão de Visitas Digital */}
      {user && (
        <DigitalBusinessCardModal
          isOpen={showBusinessCardModal}
          onClose={() => setShowBusinessCardModal(false)}
          user={user}
        />
      )}
    </div>
  );
};

export default DashboardHome;
