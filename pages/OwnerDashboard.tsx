import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, Users, FolderOpen, Settings2, Plus,
  Trash2, Check, X, Ban, RefreshCw, Clock, Shield, Star,
  Calendar, MessageSquare, CheckCircle2, TrendingUp, AlertTriangle, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { store } from '../services/store';
import { AdminStats, ServiceAd, User, UserRole, Category, AdStatus } from '../types';

type Tab = 'overview' | 'ads' | 'users' | 'categories' | 'settings';

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

const OwnerDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ads, setAds] = useState<ServiceAd[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adDurationDays, setAdDurationDays] = useState('30');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: 'Wrench' });
  const [confirmingTransfer, setConfirmingTransfer] = useState<string | null>(null);

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
    try { setUsers(await store.getUsers()); } catch (e) { console.error(e); }
  }, []);

  const loadCategories = useCallback(async () => {
    try { setCategories(await store.getAllCategories()); } catch (e) { console.error(e); }
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
      loadSettings();
    }).catch(() => {
      loadStats();
      loadUsers();
      loadCategories();
      loadSettings();
    });
  }, [loading, user, navigate, loadStats, loadUsers, loadCategories, loadSettings]);

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

  const tabItem = (id: Tab, label: string, icon: React.ComponentType<{ size?: number | string; className?: string }>, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium ${tab === id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-700 hover:bg-brand-50 hover:text-brand-700'}`}
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
        <div className="flex items-center justify-between mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-fit">
            <nav className="space-y-1">
              {tabItem('overview', 'Visão Geral', LayoutDashboard)}
              {tabItem('ads', 'Anúncios', Megaphone, stats?.adsPending || 0)}
              {tabItem('users', 'Usuários', Users)}
              {tabItem('categories', 'Categorias', FolderOpen)}
              {tabItem('settings', 'Configurações', Settings2)}
            </nav>
          </aside>

          {/* Conteúdo */}
          <div className="lg:col-span-4 space-y-4">
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Usuários</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                    <StatCard label="Total" value={stats?.totalUsers ?? 0} icon={Users} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Profissionais" value={stats?.providers ?? 0} icon={Shield} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Clientes" value={stats?.clients ?? 0} icon={Users} color="bg-green-50 text-green-600" />
                    <StatCard label="Admins" value={stats?.admins ?? 0} icon={Star} color="bg-purple-50 text-purple-600" />
                    <StatCard label="Novos (7d)" value={stats?.newUsersWeek ?? 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Anúncios</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                    <StatCard label="Total" value={stats?.totalAds ?? 0} icon={Megaphone} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Pendentes" value={stats?.adsPending ?? 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
                    <StatCard label="Aprovados" value={stats?.adsApproved ?? 0} icon={Check} color="bg-green-50 text-green-600" />
                    <StatCard label="Rejeitados" value={stats?.adsRejected ?? 0} icon={X} color="bg-red-50 text-red-600" />
                    <StatCard label="Expirados" value={stats?.adsExpired ?? 0} icon={Clock} color="bg-gray-100 text-gray-600" />
                    <StatCard label="Novos (7d)" value={stats?.newAdsWeek ?? 0} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
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
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Agendamentos & Avaliações</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                    <StatCard label="Total" value={stats?.totalAppointments ?? 0} icon={Calendar} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Pendentes" value={stats?.appointmentsPending ?? 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
                    <StatCard label="Concluídos" value={stats?.appointmentsCompleted ?? 0} icon={CheckCircle2} color="bg-green-50 text-green-600" />
                    <StatCard label="Avaliações" value={stats?.totalReviews ?? 0} icon={MessageSquare} color="bg-purple-50 text-purple-600" />
                    <StatCard label="Nota média" value={stats?.avgRating ?? 0} icon={Star} color="bg-yellow-50 text-yellow-600" />
                  </div>
                </div>
              </div>
            )}

            {tab === 'ads' && (
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

            {tab === 'users' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Usuários ({users.length})</h2>
                  {!user.isOwner && (
                    <p className="text-xs text-gray-500 mt-1">
                      Você é administrador. Somente o <strong>dono do projeto</strong> pode alterar papéis ou promover/destituir admins.
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
                        </div>
                        <p className="text-xs text-gray-500">{u.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Cadastrado em {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
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
                            <button
                              onClick={() => handleDemote(u.id)}
                              className="text-xs px-2 py-1.5 rounded flex items-center bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                            >
                              <X size={12} className="mr-1" /> Remover admin
                            </button>
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

                        {!u.isOwner && u.id !== user.id && (
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

            {tab === 'categories' && (
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
                          <span className="text-lg">{cat.icon}</span>
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

            {tab === 'settings' && (
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
    </div>
  );
};

export default OwnerDashboard;
