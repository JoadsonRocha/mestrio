import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, Users, FolderOpen, Settings2, Plus,
  Trash2, Check, X, Ban, RefreshCw, Clock, Shield, Star,
  Calendar, MessageSquare, CheckCircle2, TrendingUp, AlertTriangle, Eye, Tags
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { store } from '../services/store';
import { AdminStats, ServiceAd, User, UserRole, Category, AdStatus, Tag } from '../types';
import { categoryIcon } from '../components/CategoryIcon';

type Tab = 'overview' | 'ads' | 'users' | 'categories' | 'tags' | 'settings';

const STATUS_LABEL: Record<AdStatus, string> = {
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado',
  expired: 'Expirado', suspended: 'Suspenso'
};

const STATUS_STYLE: Record<AdStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200'
};

export const PERMISSION_LABELS: Record<string, string> = {
  moderate_ads: 'Moderar anúncios',
  manage_users: 'Suspender usuários',
  approve_providers: 'Aprovar profissionais',
  verify_providers: 'Selos de verificação',
  manage_categories: 'Gerenciar categorias',
  manage_settings: 'Configurações',
  view_metrics: 'Ver métricas'
};

const OwnerDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ads, setAds] = useState<ServiceAd[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [adDurationDays, setAdDurationDays] = useState('30');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: 'Wrench' });
  const [newTag, setNewTag] = useState({ name: '', icon: 'Check' });
  const [confirmingTransfer, setConfirmingTransfer] = useState<string | null>(null);
  const [adminPerms, setAdminPerms] = useState<Record<string, string[]>>({});
  const [editingPerms, setEditingPerms] = useState<User | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [permBusy, setPermBusy] = useState(false);
  const [messageUser, setMessageUser] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);

  const loadStats = useCallback(async () => {
    try { setStats(await store.getAdminStats()); } catch (e) { console.error(e); }
  }, []);

  const loadAds = useCallback(async () => {
    try {
      const data = await store.getAllAds({ status: filterStatus, limit: 200 });
      setAds(data);
    } catch (e) { console.error(e); }
  }, [filterStatus]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await store.getUsers();
      setUsers(data);
      if (user?.isOwner) {
        const admins = data.filter(u => u.role === UserRole.ADMIN && !u.isOwner);
        const entries = await Promise.all(
          admins.map(async a => [a.id, await store.getAdminPermissions(a.id)] as [string, string[]])
        );
        setAdminPerms(Object.fromEntries(entries));
      }
    } catch (e) { console.error(e); }
  }, [user?.isOwner]);

  const loadCategories = useCallback(async () => {
    try { setCategories(await store.getAllCategories()); } catch (e) { console.error(e); }
  }, []);

  const loadTags = useCallback(async () => {
    try { setTags(await store.getAllTags()); } catch (e) { console.error(e); }
  }, []);

  const loadSettings = useCallback(async () => {
    const days = await store.getAdDurationDays();
    setAdDurationDays(String(days));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    if (user.role !== UserRole.ADMIN) { navigate('/'); return; }
    store.expireAds().then(() => {
      loadStats();
      loadUsers();
      loadCategories();
      loadTags();
      loadSettings();
    }).catch(() => {
      loadStats();
      loadUsers();
      loadCategories();
      loadTags();
      loadSettings();
    });
  }, [loading, user, navigate, loadStats, loadUsers, loadCategories, loadTags, loadSettings]);

  useEffect(() => {
    if (tab === 'ads') loadAds();
  }, [tab, filterStatus, loadAds]);

  if (loading || !user || user.role !== UserRole.ADMIN) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // RBAC: dono tem todas as funções; admin só as concedidas pelo dono.
  const can = (perm: string) => user.isOwner || (user.permissions || []).includes(perm);

  const visibleTabs: Tab[] = [];
  if (can('view_metrics')) visibleTabs.push('overview');
  if (can('moderate_ads')) visibleTabs.push('ads');
  if (can('manage_users') || can('approve_providers') || can('verify_providers')) visibleTabs.push('users');
  if (can('manage_categories')) {
    visibleTabs.push('categories');
    visibleTabs.push('tags');
  }
  if (can('manage_settings')) visibleTabs.push('settings');

  const activeTab = visibleTabs.includes(tab) ? tab : (visibleTabs[0] ?? 'overview');

  // ---- Ações de moderação ----
  const handleStatus = async (ad: ServiceAd, status: AdStatus, reason?: string) => {
    setBusyId(ad.id);
    try {
      await store.updateAdStatus(ad.id, status, reason);
      setAds(prev => prev.filter(a => a.id !== ad.id));
      toast(`Anúncio ${STATUS_LABEL[status].toLowerCase()}.`, 'success');
      loadStats();
    } catch (e) {
      console.error(e);
      toast('Não foi possível atualizar o anúncio.', 'error');
    } finally {
      setBusyId(null);
      setRejectingId(null);
      setRejectReason('');
    }
  };

  const handleExtend = async (ad: ServiceAd, days: number) => {
    setBusyId(ad.id);
    try {
      await store.extendAd(ad.id, days);
      toast(`Anúncio renovado por ${days} dias.`, 'success');
      loadAds();
    } catch (e) {
      console.error(e);
      toast('Não foi possível renovar.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ---- Ações de usuários ----
  // Papel CLIENT/PROVIDER: somente o DONO (RPC set_user_role)
  const handleRole = async (id: string, role: UserRole) => {
    try {
      await store.setUserRole(id, role);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      toast('Papel atualizado.', 'success');
    } catch (e) { console.error(e); toast('Erro ao atualizar papel.', 'error'); }
  };

  // Promover/destituir ADMIN: somente o DONO (RPCs)
  const handlePromote = async (id: string) => {
    try {
      await store.promoteToAdmin(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: UserRole.ADMIN } : u));
      toast('Usuário promovido a administrador.', 'success');
      const promoted = users.find(u => u.id === id);
      if (promoted) openPermModal(promoted);
    } catch (e) { console.error(e); toast('Erro ao promover. Somente o dono pode fazer isso.', 'error'); }
  };

  const handleDemote = async (id: string) => {
    try {
      await store.demoteFromAdmin(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: UserRole.PROVIDER } : u));
      toast('Administrador destituído.', 'success');
    } catch (e) { console.error(e); toast('Erro ao destituir. Somente o dono pode fazer isso.', 'error'); }
  };

  // Transferir posse: somente o DONO (RPC transfer_ownership)
  const handleTransfer = async (id: string) => {
    try {
      await store.transferOwnership(id);
      toast('Posse transferida. Você agora é administrador.', 'success');
      window.location.href = '/owner';
    } catch (e) { console.error(e); toast('Erro ao transferir a posse.', 'error'); }
  };

  const handleSuspend = async (u: User) => {
    try {
      await store.setUserSuspended(u.id, !u.isSuspended);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isSuspended: !u.isSuspended } : x));
      toast(u.isSuspended ? 'Usuário reativado.' : 'Usuário suspenso.', 'success');
    } catch (e) { console.error(e); toast('Erro ao suspender.', 'error'); }
  };

  // Solicitação de profissional (cliente → PROVIDER) — aprovar/recusar admin ou dono
  const handleApproveProviderRequest = async (u: User) => {
    setBusyId(u.id);
    try {
      await store.approveProviderRequest(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: UserRole.PROVIDER, roleRequest: null } : x));
      toast(`${u.name} agora é profissional.`, 'success');
    } catch (e) { console.error(e); toast('Erro ao aprovar.', 'error'); }
    finally { setBusyId(null); }
  };

  const handleRejectProviderRequest = async (u: User) => {
    setBusyId(u.id);
    try {
      await store.rejectProviderRequest(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, roleRequest: null } : x));
      toast('Solicitação recusada.', 'success');
    } catch (e) { console.error(e); toast('Erro ao recusar.', 'error'); }
    finally { setBusyId(null); }
  };

  // Selo de verificação — admin ou dono
  const handleCertify = async (u: User) => {
    setBusyId(u.id);
    try {
      await store.setUserCertified(u.id, !u.isCertified);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isCertified: !u.isCertified } : x));
      toast(u.isCertified ? `Selo removido de ${u.name}.` : `Selo de verificação concedido a ${u.name}.`, 'success');
    } catch (e) { console.error(e); toast('Erro ao alterar o selo.', 'error'); }
    finally { setBusyId(null); }
  };

  // ---- Permissões por admin (somente o DONO) ----
  const openPermModal = async (u: User) => {
    setEditingPerms(u);
    setSelectedPerms([]);
    if (u.role === UserRole.ADMIN && !u.isOwner) {
      try {
        setSelectedPerms(await store.getAdminPermissions(u.id));
      } catch (e) { console.error(e); }
    }
  };

  const handleSavePerms = async () => {
    if (!editingPerms) return;
    setPermBusy(true);
    try {
      await store.setAdminPermissions(editingPerms.id, selectedPerms);
      setAdminPerms(prev => ({ ...prev, [editingPerms.id]: selectedPerms }));
      toast('Permissões salvas.', 'success');
      setEditingPerms(null);
    } catch (e) { console.error(e); toast('Erro ao salvar permissões.', 'error'); }
    finally { setPermBusy(false); }
  };

  // ---- Ações de categorias ----
  const handleAddCategory = async () => {
    if (!newCat.name.trim()) return;
    const slug = newCat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) { toast('Nome inválido.', 'error'); return; }
    try {
      await store.createCategory({ slug, name: newCat.name.trim(), icon: newCat.icon, sortOrder: categories.length + 1 });
      setNewCat({ name: '', icon: 'Wrench' });
      await loadCategories();
      toast('Categoria criada.', 'success');
    } catch (e) { console.error(e); toast('Erro ao criar categoria.', 'error'); }
  };

  const handleToggleCategory = async (cat: Category) => {
    try {
      await store.updateCategory(cat.id, { active: !cat.active });
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !c.active } : c));
    } catch (e) { console.error(e); toast('Erro ao atualizar.', 'error'); }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await store.deleteCategory(cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      toast('Categoria excluída.', 'success');
    } catch (e) { console.error(e); toast('Erro ao excluir.', 'error'); }
  };

  // ---- Ações de Tags Globais ----
  const handleAddTag = async () => {
    if (!newTag.name.trim()) return;
    const slug = newTag.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) { toast('Nome inválido.', 'error'); return; }
    try {
      await store.createTag({ slug, name: newTag.name.trim(), icon: newTag.icon, sortOrder: tags.length + 1 });
      setNewTag({ name: '', icon: 'Check' });
      await loadTags();
      toast('Tag criada.', 'success');
    } catch (e) { console.error(e); toast('Erro ao criar tag.', 'error'); }
  };

  const handleToggleTag = async (tag: Tag) => {
    try {
      await store.updateTag(tag.id, { active: !tag.active });
      setTags(prev => prev.map(t => t.id === tag.id ? { ...t, active: !t.active } : t));
    } catch (e) { console.error(e); toast('Erro ao atualizar tag.', 'error'); }
  };

  const handleDeleteTag = async (tag: Tag) => {
    try {
      await store.deleteTag(tag.id);
      setTags(prev => prev.filter(t => t.id !== tag.id));
      toast('Tag excluída.', 'success');
    } catch (e) { console.error(e); toast('Erro ao excluir tag.', 'error'); }
  };

  // ---- Configurações ----
  const handleSaveSettings = async () => {
    const days = parseInt(adDurationDays, 10);
    if (isNaN(days) || days <= 0) { toast('Informe um número válido de dias.', 'error'); return; }
    setBusy(true);
    try {
      await store.setAdDurationDays(days);
      toast('Configurações salvas.', 'success');
    } catch (e) { console.error(e); toast('Erro ao salvar.', 'error'); }
    finally { setBusy(false); }
  };

  const handleSendMessageToUser = async () => {
    if (!messageUser || !messageText.trim()) return;
    setMessageBusy(true);
    try {
      const chatId = await store.startDirectChat(messageUser.id);
      await store.sendMessage(chatId, user.id, messageText.trim());
      toast(`Mensagem enviada para ${messageUser.name}.`, 'success');
      setMessageUser(null);
      setMessageText('');
    } catch (e) {
      console.error(e);
      toast('Não foi possível enviar a mensagem.', 'error');
    } finally {
      setMessageBusy(false);
    }
  };

  const tabItem = (id: Tab, label: string, icon: React.ComponentType<{ size?: number | string; className?: string }>, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-700 hover:bg-brand-50 hover:text-brand-700'}`}
    >
      {React.createElement(icon, { size: 16, className: "mr-3 text-brand-600" })}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{badge}</span>
      )}
    </button>
  );

  const StatCard: React.FC<{ label: string; value: number | string; icon: React.ComponentType<{ size?: number | string; className?: string }>; color: string }> = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-4 justify-between mb-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Painel do Dono</h1>
            {user.isOwner ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold uppercase tracking-wide">Dono</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 font-semibold uppercase tracking-wide">Admin</span>
            )}
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-brand-600 font-medium">Voltar ao início →</Link>
        </div>

        {stats && (stats.adsPending > 0 || stats.pendingProviderRequests > 0 || stats.suspendedUsers > 0) && (
          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-yellow-700">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <p className="font-semibold text-yellow-900">Atenção: ações urgentes</p>
                <div className="mt-2 space-y-1">
                  {stats.adsPending > 0 && (
                    <p>Há <strong>{stats.adsPending}</strong> anúncios pendentes aguardando moderação.</p>
                  )}
                  {stats.pendingProviderRequests > 0 && (
                    <p>Existem <strong>{stats.pendingProviderRequests}</strong> solicitações de profissional aguardando aprovação.</p>
                  )}
                  {stats.suspendedUsers > 0 && (
                    <p>Há <strong>{stats.suspendedUsers}</strong> usuários suspensos. Revise se o bloqueio ainda é necessário.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-fit">
            <nav className="space-y-1">
              {can('view_metrics') && tabItem('overview', 'Visão Geral', LayoutDashboard)}
              {can('moderate_ads') && tabItem('ads', 'Anúncios', Megaphone, stats?.adsPending || 0)}
              {(can('manage_users') || can('approve_providers') || can('verify_providers')) && tabItem('users', 'Usuários', Users)}
              {can('manage_categories') && tabItem('categories', 'Categorias', FolderOpen)}
              {can('manage_categories') && tabItem('tags', 'Tags', Tags)}
              {can('manage_settings') && tabItem('settings', 'Configurações', Settings2)}
            </nav>
          </aside>

          {/* Conteúdo */}
          <div className="lg:col-span-4 space-y-4">
            {visibleTabs.length === 0 && !user.isOwner && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-500">
                <Shield size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-700">Sem permissões concedidas</p>
                <p className="text-sm text-gray-500 mt-1">Peça ao dono para definir suas funções de administrador.</p>
              </div>
            )}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Usuários</h2>
                  <p className="text-xs text-gray-500">Base da plataforma</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                    <StatCard label="Total" value={stats?.totalUsers ?? 0} icon={Users} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Profissionais" value={stats?.providers ?? 0} icon={Shield} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Clientes" value={stats?.clients ?? 0} icon={Users} color="bg-green-50 text-green-600" />
                    <StatCard label="Admins" value={stats?.admins ?? 0} icon={Star} color="bg-purple-50 text-purple-600" />
                    <StatCard label="Suspensos" value={stats?.suspendedUsers ?? 0} icon={Ban} color="bg-orange-50 text-orange-700" />
                    <StatCard label="Solicitações (profs)" value={stats?.pendingProviderRequests ?? 0} icon={Plus} color="bg-yellow-50 text-yellow-700" />
                    <StatCard label="Novos (7d)" value={stats?.newUsersWeek ?? 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Anúncios</h2>
                  <p className="text-xs text-gray-500">Cadastros de serviços na plataforma</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                    <StatCard label="Total" value={stats?.totalAds ?? 0} icon={Megaphone} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Visualizações" value={stats?.totalViews ?? 0} icon={Eye} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Pendentes" value={stats?.adsPending ?? 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
                    <StatCard label="Aprovados" value={stats?.adsApproved ?? 0} icon={Check} color="bg-green-50 text-green-600" />
                    <StatCard label="Rejeitados" value={stats?.adsRejected ?? 0} icon={X} color="bg-red-50 text-red-600" />
                    <StatCard label="Suspensos" value={stats?.adsSuspended ?? 0} icon={Ban} color="bg-orange-50 text-orange-600" />
                    <StatCard label="Novos (7d)" value={stats?.newAdsWeek ?? 0} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
                  </div>
                  {stats && stats.adsPending > 0 && (
                    <button
                      onClick={() => setTab('ads')}
                      className="mt-4 bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-brand-700 transition-colors"
                    >
                      Aprovar pendentes ({stats.adsPending})
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Agendamentos (serviços)</h2>
                  <p className="text-xs text-gray-500">Fluxo de serviços realizados pela plataforma</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                    <StatCard label="Total" value={stats?.totalAppointments ?? 0} icon={Calendar} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Pendentes" value={stats?.appointmentsPending ?? 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
                    <StatCard label="Confirmados" value={stats?.appointmentsConfirmed ?? 0} icon={Check} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Concluídos" value={stats?.appointmentsCompleted ?? 0} icon={CheckCircle2} color="bg-green-50 text-green-600" />
                    <StatCard label="Cancelados" value={stats?.appointmentsCancelled ?? 0} icon={X} color="bg-red-50 text-red-600" />
                    <StatCard label="Novos (7d)" value={stats?.newAppointmentsWeek ?? 0} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
                  </div>
                  {stats && stats.totalAppointments > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Taxa de conclusão</span>
                        <span className="font-semibold text-gray-700">{Math.round((stats.appointmentsCompleted / stats.totalAppointments) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.round((stats.appointmentsCompleted / stats.totalAppointments) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Categorias mais procuradas</h2>
                  <p className="text-xs text-gray-500">Anúncios ativos por categoria</p>
                  {(!stats || stats.adsByCategory.length === 0) ? (
                    <p className="text-sm text-gray-400 mt-4">Nenhum anúncio aprovado ainda.</p>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {stats.adsByCategory.slice(0, 5).map(c => {
                        const max = stats.adsByCategory[0].count;
                        const name = categories.find(cc => cc.slug === c.category)?.name || c.category;
                        return (
                          <div key={c.category}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700">{name}</span>
                              <span className="text-gray-500">{c.count} {c.count === 1 ? 'anúncio' : 'anúncios'}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-brand-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.round((c.count / max) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Top anúncios avaliados</h2>
                  <p className="text-xs text-gray-500">Serviços com mais avaliações na plataforma</p>
                  {(!stats || stats.topAds.length === 0) ? (
                    <p className="text-sm text-gray-400 mt-4">Nenhum anúncio avaliado ainda.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 mt-3">
                      {stats.topAds.map((ad, i) => {
                        const name = categories.find(cc => cc.slug === ad.category)?.name || ad.category;
                        return (
                          <div key={ad.id} className="py-3 flex items-center gap-3">
                            <span className="w-6 text-center text-sm font-bold text-gray-300">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{ad.title}</p>
                              <p className="text-xs text-gray-500">{ad.providerName} · {name}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-gray-800 flex items-center justify-end gap-1">
                                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                {ad.rating.toFixed(1)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {ad.reviewCount} {ad.reviewCount === 1 ? 'avaliação' : 'avaliações'} · <Eye size={10} className="inline mr-0.5 text-gray-400" />{ad.views || 0}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Avaliações</h2>
                  <p className="text-xs text-gray-500">Feedback dos clientes</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <StatCard label="Avaliações" value={stats?.totalReviews ?? 0} icon={MessageSquare} color="bg-purple-50 text-purple-600" />
                    <StatCard label="Novas avaliações (7d)" value={stats?.newReviewsWeek ?? 0} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Nota média" value={stats?.avgRating ?? 0} icon={Star} color="bg-yellow-50 text-yellow-600" />
                    <StatCard label="Aprovação" value={stats ? `${stats.approvalRate}%` : '0%'} icon={Check} color="bg-green-50 text-green-600" />
                    <StatCard label="Média de views" value={stats?.avgViewsPerApprovedAd ?? 0} icon={Eye} color="bg-brand-50 text-brand-600" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ads' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Moderação de Anúncios</h2>
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'approved', 'rejected', 'suspended', 'all'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {s === 'all' ? 'Todos' : STATUS_LABEL[s as AdStatus]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {ads.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                      <Megaphone size={28} className="mx-auto mb-3 text-gray-300" />
                      Nenhum anúncio {filterStatus === 'all' ? '' : STATUS_LABEL[filterStatus as AdStatus].toLowerCase()}.
                    </div>
                  ) : ads.map(ad => (
                    <div key={ad.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{ad.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[ad.status || 'pending']}`}>
                            {STATUS_LABEL[ad.status || 'pending']}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">{ad.description}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 flex-wrap">
                          <span>{ad.providerName}</span>
                          <span className="flex items-center"><Star size={12} className="mr-1 text-yellow-500" />{ad.rating || 0} ({ad.reviewCount})</span>
                          <span className="flex items-center"><Eye size={12} className="mr-1 text-gray-400" />{ad.views || 0} visualizações</span>
                          <span>{ad.category}</span>
                          <span>{ad.location}</span>
                          {ad.expiresAt && (
                            <span className="flex items-center">
                              <Clock size={12} className="mr-1" />
                              Expira {new Date(ad.expiresAt).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        {ad.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1 flex items-center"><AlertTriangle size={12} className="mr-1" />Motivo: {ad.rejectionReason}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap md:shrink-0">
                        <Link to={`/service/${ad.id}`} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center">
                          <Eye size={12} className="mr-1" /> Ver
                        </Link>
                        {ad.status === 'pending' && (
                          <>
                            <button onClick={() => handleStatus(ad, 'approved')} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 flex items-center disabled:opacity-50">
                              <Check size={12} className="mr-1" /> Aprovar
                            </button>
                            <button onClick={() => setRejectingId(ad.id)} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 flex items-center disabled:opacity-50">
                              <X size={12} className="mr-1" /> Rejeitar
                            </button>
                          </>
                        )}
                        {(ad.status === 'approved' || ad.status === 'expired' || ad.status === 'suspended') && (
                          <>
                            {ad.status === 'expired' && (
                              <button onClick={() => handleExtend(ad, 30)} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center disabled:opacity-50">
                                <RefreshCw size={12} className="mr-1" /> Renovar 30d
                              </button>
                            )}
                            {ad.status === 'approved' && (
                              <button onClick={() => handleExtend(ad, 30)} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center disabled:opacity-50">
                                <RefreshCw size={12} className="mr-1" /> +30d
                              </button>
                            )}
                            <button onClick={() => handleStatus(ad, 'suspended')} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 flex items-center disabled:opacity-50">
                              <Ban size={12} className="mr-1" /> Suspender
                            </button>
                          </>
                        )}
                        {(ad.status === 'suspended') && (
                          <button onClick={() => handleStatus(ad, 'approved')} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 flex items-center disabled:opacity-50">
                            <Check size={12} className="mr-1" /> Reativar
                          </button>
                        )}
                        {ad.status === 'rejected' && (
                          <button onClick={() => handleStatus(ad, 'approved')} disabled={busyId === ad.id} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 flex items-center disabled:opacity-50">
                            <Check size={12} className="mr-1" /> Aprovar
                          </button>
                        )}
                      </div>

                      {rejectingId === ad.id && (
                        <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-lg p-3">
                          <label className="block text-xs font-medium text-red-700 mb-1">Motivo da rejeição</label>
                          <input
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Ex.: fotos faltando, categoria incorreta..."
                            className="w-full text-sm px-3 py-1.5 rounded border border-red-200 bg-white"
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleStatus(ad, 'rejected', rejectReason.trim() || 'Não informado')} disabled={busyId === ad.id} className="text-xs px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                              Confirmar rejeição
                            </button>
                            <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="text-xs px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Usuários ({users.length})</h2>
                  {!user.isOwner && (
                    <p className="text-xs text-gray-500 mt-1">
                      Você é administrador. Pode moderar anúncios, suspender, verificar profissionais e <strong>aprovar solicitações de profissional</strong>. Somente o <strong>dono</strong> altera papéis ou promove/destitui admins.
                    </p>
                  )}
                  {user.isOwner && (
                    <p className="text-xs text-gray-500 mt-1">
                      Você é o <strong>dono</strong>. Ações de papel, admin e posse estão disponíveis para você.
                    </p>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {users.map(u => (
                    <div key={u.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                      <img loading="lazy" decoding="async" src={u.avatar || 'https://via.placeholder.com/50'} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                          {u.isOwner && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Dono</span>
                          )}
                          {u.isCertified && u.role === UserRole.PROVIDER && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">Verificado</span>
                          )}
                          {u.role === UserRole.ADMIN && !u.isOwner && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 font-medium">Admin</span>
                          )}
                          {u.role === UserRole.PROVIDER && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">Profissional</span>
                          )}
                          {u.role === UserRole.CLIENT && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Cliente</span>
                          )}
                          {u.isSuspended && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Suspenso</span>
                          )}
                          {u.roleRequest === 'PROVIDER' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Solicitou ser profissional</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{u.email}</p>
                        {u.role === UserRole.ADMIN && !u.isOwner && (adminPerms[u.id]?.length || 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {adminPerms[u.id].map(p => (
                              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {PERMISSION_LABELS[p] || p}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">Cadastrado em {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => setMessageUser(u)}
                            className="text-xs px-2 py-1.5 rounded flex items-center bg-blue-100 text-blue-700 hover:bg-blue-200"
                            title="Enviar Mensagem"
                          >
                            💬 Mensagem
                          </button>
                        )}
                        {u.roleRequest === 'PROVIDER' && can('approve_providers') && (
                          <>
                            <button
                              onClick={() => handleApproveProviderRequest(u)}
                              disabled={busyId === u.id}
                              className="text-xs px-2 py-1.5 rounded flex items-center bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              <Check size={12} className="mr-1" /> Aprovar
                            </button>
                            <button
                              onClick={() => handleRejectProviderRequest(u)}
                              disabled={busyId === u.id}
                              className="text-xs px-2 py-1.5 rounded flex items-center bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                            >
                              <X size={12} className="mr-1" /> Recusar
                            </button>
                          </>
                        )}

                        {user.isOwner && !u.isOwner && u.role !== UserRole.ADMIN && (
                          <select
                            value={u.role === UserRole.ADMIN ? UserRole.PROVIDER : u.role}
                            onChange={e => handleRole(u.id, e.target.value as UserRole)}
                            className="text-xs px-2 py-1.5 rounded border border-gray-200 bg-white text-gray-700"
                          >
                            <option value={UserRole.PROVIDER}>Profissional</option>
                            <option value={UserRole.CLIENT}>Cliente</option>
                          </select>
                        )}

                        {user.isOwner && !u.isOwner && (
                          u.role === UserRole.ADMIN ? (
                            <>
                              <button
                                onClick={() => openPermModal(u)}
                                className="text-xs px-2 py-1.5 rounded flex items-center bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100"
                                title="Definir as funções deste administrador"
                              >
                                <Shield size={12} className="mr-1" /> Permissões
                              </button>
                              <button
                                onClick={() => handleDemote(u.id)}
                                className="text-xs px-2 py-1.5 rounded flex items-center bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                              >
                                <X size={12} className="mr-1" /> Remover admin
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handlePromote(u.id)}
                              className="text-xs px-2 py-1.5 rounded flex items-center bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100"
                            >
                              <Shield size={12} className="mr-1" /> Promover a admin
                            </button>
                          )
                        )}

                        {user.isOwner && !u.isOwner && u.id !== user.id && (
                          confirmingTransfer === u.id ? (
                            <button
                              onClick={() => handleTransfer(u.id)}
                              className="text-xs px-2 py-1.5 rounded flex items-center bg-red-600 text-white hover:bg-red-700"
                            >
                              Confirmar posse?
                            </button>
                          ) : (
                            <button
                              onClick={() => { setConfirmingTransfer(u.id); window.setTimeout(() => setConfirmingTransfer(prev => prev === u.id ? null : prev), 5000); }}
                              className="text-xs px-2 py-1.5 rounded flex items-center bg-gray-100 text-gray-600 hover:bg-gray-200"
                              title="Transferir a propriedade do projeto para este usuário"
                            >
                              <RefreshCw size={12} className="mr-1" /> Transferir posse
                            </button>
                          )
                        )}

                        {u.role === UserRole.PROVIDER && !u.isOwner && can('verify_providers') && (
                          <button
                            onClick={() => handleCertify(u)}
                            disabled={busyId === u.id}
                            title="Selo de verificação concedido pelo dono/admin"
                            className={`text-xs px-2 py-1.5 rounded flex items-center disabled:opacity-50 ${u.isCertified ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                          >
                            <CheckCircle2 size={12} className="mr-1" /> {u.isCertified ? 'Remover selo' : 'Verificar'}
                          </button>
                        )}

                        {!u.isOwner && u.id !== user.id && can('manage_users') && (
                          <button
                            onClick={() => handleSuspend(u)}
                            className={`text-xs px-2 py-1.5 rounded flex items-center ${u.isSuspended ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'}`}
                          >
                            <Ban size={12} className="mr-1" /> {u.isSuspended ? 'Reativar' : 'Suspender'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Categorias</h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={newCat.name}
                      onChange={e => setNewCat(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome da nova categoria"
                      className="flex-1 text-sm px-3 py-1.5 rounded border border-gray-200"
                    />
                    <input
                      value={newCat.icon}
                      onChange={e => setNewCat(prev => ({ ...prev, icon: e.target.value }))}
                      placeholder="Ícone (ex.: Wrench)"
                      className="sm:w-40 text-sm px-3 py-1.5 rounded border border-gray-200"
                    />
                    <button onClick={handleAddCategory} className="bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-brand-700 flex items-center justify-center">
                      <Plus size={16} className="mr-1" /> Adicionar
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {categories.map(cat => (
                    <div key={cat.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-gray-100 text-brand-600 flex items-center justify-center">
                          {categoryIcon(cat.slug, 20)}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">{cat.name}</p>
                          <p className="text-xs text-gray-400">/{cat.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleCategory(cat)}
                          className={`text-xs px-2 py-1 rounded border ${cat.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                        >
                          {cat.active ? 'Ativa' : 'Inativa'}
                        </button>
                        <button onClick={() => handleDeleteCategory(cat)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center">
                          <Trash2 size={12} className="mr-1" /> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Tags / Comodidades</h2>
                  <p className="text-xs text-gray-500 mb-3">Filtros rápidos globais que os profissionais podem marcar nos anúncios.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={newTag.name}
                      onChange={e => setNewTag(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome da tag (ex: 24 Horas)"
                      className="flex-1 text-sm px-3 py-1.5 rounded border border-gray-200"
                    />
                    <input
                      value={newTag.icon}
                      onChange={e => setNewTag(prev => ({ ...prev, icon: e.target.value }))}
                      placeholder="Ícone (ex: Clock)"
                      className="sm:w-40 text-sm px-3 py-1.5 rounded border border-gray-200"
                    />
                    <button onClick={handleAddTag} className="bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-brand-700 flex items-center justify-center">
                      <Plus size={16} className="mr-1" /> Adicionar
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {tags.map(tag => (
                    <div key={tag.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-gray-100 text-brand-600 flex items-center justify-center">
                          {categoryIcon(tag.slug, 20)}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">{tag.name}</p>
                          <p className="text-xs text-gray-400">/{tag.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleTag(tag)}
                          className={`text-xs px-2 py-1 rounded border ${tag.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                        >
                          {tag.active ? 'Ativa' : 'Inativa'}
                        </button>
                        <button onClick={() => handleDeleteTag(tag)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center">
                          <Trash2 size={12} className="mr-1" /> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Configurações da Plataforma</h2>
                <div className="max-w-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração dos anúncios (dias)</label>
                  <input
                    type="number"
                    min={1}
                    value={adDurationDays}
                    onChange={e => setAdDurationDays(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded border border-gray-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">Período de validade aplicado aos novos anúncios aprovados.</p>
                  <button
                    onClick={handleSaveSettings}
                    disabled={busy}
                    className="mt-4 bg-brand-600 text-white text-sm px-4 py-2 rounded-md hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {busy ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Permissões de {editingPerms.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Selecione as funções deste administrador. O dono tem acesso total.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 p-2 rounded border border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(key)}
                    onChange={e => setSelectedPerms(prev => e.target.checked ? [...prev, key] : prev.filter(p => p !== key))}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-sm text-gray-800">{label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingPerms(null)}
                className="text-sm px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePerms}
                disabled={permBusy}
                className="text-sm px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {permBusy ? 'Salvando...' : 'Salvar permissões'}
              </button>
            </div>
          </div>
        </div>
      )}

      {messageUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Enviar mensagem para {messageUser.name}</h3>
                <p className="text-xs text-gray-500">A mensagem será enviada como administrador.</p>
              </div>
              <button onClick={() => setMessageUser(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              rows={6}
              placeholder="Escreva sua mensagem..."
              className="w-full text-sm px-3 py-3 rounded border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setMessageUser(null)}
                className="text-sm px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendMessageToUser}
                disabled={messageBusy || !messageText.trim()}
                className="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {messageBusy ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
