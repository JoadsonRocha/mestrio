import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, Users, FolderOpen, Settings2, Plus,
  Trash2, Check, X, Ban, RefreshCw, Clock, Shield, Star,
  Calendar, MessageSquare, CheckCircle2, TrendingUp, AlertTriangle, Eye,
  FileText, Download, Bell, Activity, Search, Filter, Layers, Sun, Moon,
  ChevronRight, ArrowUpRight, BarChart2, PieChart, Info, ShieldAlert, ShieldCheck, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCategories } from '../../context/CategoriesContext';
import { store } from '../../services/store';
import { AdminStats, ServiceAd, User, UserRole, Category, AdStatus, AuditLogItem, SystemBroadcast, UserReport, KYCDocument, ReportStatus, KYCStatus } from '../../types';

type Tab = 'overview' | 'ads' | 'users' | 'reports' | 'kyc' | 'categories' | 'settings' | 'audit' | 'broadcasts';
type DateRange = '7d' | '30d' | '90d' | 'all';

const STATUS_LABEL: Record<AdStatus, string> = {
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado',
  expired: 'Expirado', suspended: 'Suspenso'
};

const STATUS_STYLE: Record<AdStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  expired: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  suspended: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
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

// Componente para Gráfico Donut de Status (Power BI Style SVG)
const StatusDonutChart: React.FC<{
  approved: number;
  pending: number;
  rejected: number;
  suspended: number;
  expired: number;
  isDark: boolean;
}> = ({ approved, pending, rejected, suspended, expired, isDark }) => {
  const total = approved + pending + rejected + suspended + expired;
  if (total === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-sm">
        <PieChart size={32} className="mb-2 opacity-50" />
        Nenhum anúncio cadastrado
      </div>
    );
  }

  const items = [
    { label: 'Aprovados', count: approved, color: '#10B981' },
    { label: 'Pendentes', count: pending, color: '#F59E0B' },
    { label: 'Rejeitados', count: rejected, color: '#EF4444' },
    { label: 'Suspensos', count: suspended, color: '#F97316' },
    { label: 'Expirados', count: expired, color: '#6B7280' },
  ].filter(i => i.count > 0);

  let cumulativeAngle = 0;
  const radius = 65;
  const strokeWidth = 24;
  const center = 90;
  const circumference = 2 * Math.PI * radius;

  const slices = items.map(item => {
    const percentage = item.count / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    cumulativeAngle += percentage;

    return (
      <circle
        key={item.label}
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke={item.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-500 hover:opacity-85 cursor-pointer"
      />
    );
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
      <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90 transform">
          {slices}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{total}</span>
          <span className="text-[11px] font-medium text-slate-400">Total Anúncios</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 w-full">
        {items.map(item => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.count}</span>
                <span className="text-slate-400 text-[11px]">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Componente para Gráfico de Área/Tendência SVG (Power BI Style)
const GrowthAreaChart: React.FC<{ isDark: boolean; dataPoints?: number[] }> = ({ isDark, dataPoints = [12, 18, 25, 30, 42, 58, 75] }) => {
  const width = 500;
  const height = 160;
  const padding = 20;

  const maxVal = Math.max(...dataPoints, 100);
  const minVal = 0;

  const points = dataPoints.map((val, idx) => {
    const x = padding + (idx / (dataPoints.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);
    return { x, y, val };
  });

  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (pt.x - prev.x) / 2;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="w-full">
      <div className="relative h-44 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="pbiAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F2C811" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F2C811" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Horizontal */}
          {[0, 0.33, 0.66, 1].map((pct, i) => {
            const y = height - padding - pct * (height - 2 * padding);
            return (
              <line
                key={i}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke={isDark ? '#334155' : '#E2E8F0'}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Área com gradiente */}
          <path d={areaD} fill="url(#pbiAreaGradient)" />

          {/* Linha principal */}
          <path d={pathD} fill="none" stroke="#F2C811" strokeWidth="3" strokeLinecap="round" />

          {/* Pontos com brilho */}
          {points.map((pt, i) => (
            <g key={i} className="group cursor-pointer">
              <circle cx={pt.x} cy={pt.y} r="5" fill="#F2C811" stroke={isDark ? '#1E293B' : '#FFFFFF'} strokeWidth="2" />
              <circle cx={pt.x} cy={pt.y} r="8" fill="#F2C811" opacity="0.3" className="animate-pulse" />
            </g>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-2 px-2">
        <span>Seg</span>
        <span>Ter</span>
        <span>Qua</span>
        <span>Qui</span>
        <span>Sex</span>
        <span>Sáb</span>
        <span>Dom (Hoje)</span>
      </div>
    </div>
  );
};

// Mini Sparkline para KPI Cards
const MiniSparkline: React.FC<{ color?: string }> = ({ color = '#10B981' }) => (
  <svg viewBox="0 0 60 20" className="w-16 h-6 overflow-visible">
    <path
      d="M 2 15 Q 15 18, 25 10 T 45 6 T 58 2"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

type UserRoleFilter = 'all' | 'PROVIDER' | 'CLIENT' | 'ADMIN' | 'pending_provider';

const OwnerDashboard: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshCategories } = useCategories();

  const handleAdminLogout = async () => {
    navigate('/');
    await logout();
  };

  const [isDark, setIsDark] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [searchTerm, setSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>('all');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ads, setAds] = useState<ServiceAd[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adDurationDays, setAdDurationDays] = useState('30');
  const [inspectAd, setInspectAd] = useState<ServiceAd | null>(null);
  const [inspectUser, setInspectUser] = useState<User | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: 'Wrench' });
  const [confirmingTransfer, setConfirmingTransfer] = useState<string | null>(null);
  const [adminPerms, setAdminPerms] = useState<Record<string, string[]>>({});
  const [editingPerms, setEditingPerms] = useState<User | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [permBusy, setPermBusy] = useState(false);

  // Audit logs & Broadcasts State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<SystemBroadcast[]>([]);
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcTarget, setBcTarget] = useState<'ALL' | 'PROVIDER' | 'CLIENT'>('ALL');
  const [bcBusy, setBcBusy] = useState(false);

  // Denúncias e KYC State
  const [reports, setReports] = useState<UserReport[]>([]);
  const [kycDocs, setKycDocs] = useState<KYCDocument[]>([]);
  const [reportFilter, setReportFilter] = useState<string>('pending');
  const [kycFilter, setKycFilter] = useState<string>('pending');

  const loadReports = useCallback(async () => {
    try { setReports(await store.getReports()); } catch (e) { console.error(e); }
  }, []);

  const loadKYCDocs = useCallback(async () => {
    try { setKycDocs(await store.getKYCDocuments()); } catch (e) { console.error(e); }
  }, []);

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

  const loadSettings = useCallback(async () => {
    const days = await store.getAdDurationDays();
    setAdDurationDays(String(days));
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try { setAuditLogs(await store.getAuditLogs()); } catch (e) { console.error(e); }
  }, []);

  const loadBroadcasts = useCallback(async () => {
    try { setBroadcasts(await store.getSystemBroadcasts()); } catch (e) { console.error(e); }
  }, []);

  const refreshAllData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadStats(),
        loadAds(),
        loadUsers(),
        loadCategories(),
        loadSettings(),
        loadAuditLogs(),
        loadBroadcasts(),
        loadReports(),
        loadKYCDocs()
      ]);
      toast('Dados atualizados com sucesso!', 'success');
    } catch (e) {
      toast('Erro ao atualizar dados.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    if (user.role !== UserRole.ADMIN) { navigate('/'); return; }
    store.expireAds().then(() => {
      loadStats();
      loadUsers();
      loadCategories();
      loadSettings();
      loadAuditLogs();
      loadBroadcasts();
      loadReports();
      loadKYCDocs();
    }).catch(() => {
      loadStats();
      loadUsers();
      loadCategories();
      loadSettings();
      loadReports();
      loadKYCDocs();
      loadAuditLogs();
      loadBroadcasts();
    });
  }, [loading, user, navigate, loadStats, loadUsers, loadCategories, loadSettings, loadAuditLogs, loadBroadcasts, loadReports, loadKYCDocs]);

  useEffect(() => {
    if (tab === 'ads') loadAds();
    if (tab === 'audit') loadAuditLogs();
    if (tab === 'broadcasts') loadBroadcasts();
  }, [tab, filterStatus, loadAds, loadAuditLogs, loadBroadcasts]);

  if (loading || !user || user.role !== UserRole.ADMIN) {
    return (
      <div className="flex-1 bg-slate-900 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-[#F2C811] border-t-transparent rounded-full" />
      </div>
    );
  }

  // RBAC: dono tem todas as funções; admin só as concedidas pelo dono.
  const can = (perm: string) => user.isOwner || (user.permissions || []).includes(perm);

  const visibleTabs: Tab[] = [];
  if (can('view_metrics')) visibleTabs.push('overview');
  if (can('moderate_ads')) visibleTabs.push('ads');
  if (can('manage_users') || can('approve_providers') || can('verify_providers')) visibleTabs.push('users');
  visibleTabs.push('reports');
  visibleTabs.push('kyc');
  if (can('manage_categories')) visibleTabs.push('categories');
  visibleTabs.push('audit');
  visibleTabs.push('broadcasts');
  if (can('manage_settings')) visibleTabs.push('settings');

  const activeTab = visibleTabs.includes(tab) ? tab : (visibleTabs[0] ?? 'overview');

  // Exportação CSV
  const handleExportUsers = () => {
    const rows = users.map(u => ({
      ID: u.id,
      Nome: u.name,
      Email: u.email,
      Funcao: u.role,
      Certificado: u.isCertified ? 'Sim' : 'Não',
      Suspenso: u.isSuspended ? 'Sim' : 'Não',
      DataCriacao: u.createdAt || 'N/A'
    }));
    store.exportToCSV('Mestrio_PowerBI_Usuarios', rows);
    toast('Relatório Power BI de usuários exportado!', 'success');
  };

  const handleExportAds = () => {
    const rows = ads.map(a => ({
      ID: a.id,
      Titulo: a.title,
      Prestador: a.providerName,
      Categoria: a.category,
      Preco: a.price,
      Status: a.status,
      Visualizacoes: a.views || 0,
      DataCriacao: a.createdAt
    }));
    store.exportToCSV('Mestrio_PowerBI_Anuncios', rows);
    toast('Relatório Power BI de anúncios exportado!', 'success');
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcMessage.trim()) return;
    setBcBusy(true);
    try {
      await store.createSystemBroadcast({
        title: bcTitle,
        message: bcMessage,
        targetRole: bcTarget,
        type: 'info',
        active: true,
      });
      toast('Comunicado publicado no painel!', 'success');
      setBcTitle('');
      setBcMessage('');
      loadBroadcasts();
    } catch (e) {
      toast('Erro ao publicar comunicado.', 'error');
    } finally {
      setBcBusy(false);
    }
  };

  const handleToggleBroadcast = async (id: string) => {
    try {
      await store.toggleSystemBroadcast(id);
      loadBroadcasts();
      toast('Status do comunicado atualizado.', 'info');
    } catch (e) {
      toast('Erro ao alterar comunicado.', 'error');
    }
  };

  // Ações de moderação
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

  // Ações de usuários
  const handleRole = async (id: string, role: UserRole) => {
    try {
      await store.setUserRole(id, role);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      toast('Papel atualizado com sucesso.', 'success');
    } catch (e) { console.error(e); toast('Erro ao atualizar papel.', 'error'); }
  };

  const handlePromote = async (id: string) => {
    try {
      await store.promoteToAdmin(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: UserRole.ADMIN } : u));
      toast('Usuário promovido a administrador.', 'success');
      const promoted = users.find(u => u.id === id);
      if (promoted) openPermModal(promoted);
    } catch (e) { console.error(e); toast('Erro ao promover. Somente o dono tem essa permissão.', 'error'); }
  };

  const handleDemote = async (id: string) => {
    try {
      await store.demoteFromAdmin(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: UserRole.PROVIDER } : u));
      toast('Administrador destituído.', 'success');
    } catch (e) { console.error(e); toast('Erro ao destituir. Somente o dono tem essa permissão.', 'error'); }
  };

  const handleTransfer = async (id: string) => {
    try {
      await store.transferOwnership(id);
      toast('Posse transferida com sucesso. Você agora é administrador.', 'success');
      window.location.href = '/owner';
    } catch (e) { console.error(e); toast('Erro ao transferir a posse.', 'error'); }
  };

  const handleSuspend = async (u: User) => {
    try {
      await store.setUserSuspended(u.id, !u.isSuspended);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isSuspended: !u.isSuspended } : x));
      toast(u.isSuspended ? 'Usuário reativado.' : 'Usuário suspenso.', 'success');
    } catch (e) { console.error(e); toast('Erro ao alterar status de suspensão.', 'error'); }
  };

  const handleApproveProviderRequest = async (u: User) => {
    setBusyId(u.id);
    try {
      await store.approveProviderRequest(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: UserRole.PROVIDER, roleRequest: null } : x));
      toast(`${u.name} agora é profissional verificado.`, 'success');
    } catch (e) { console.error(e); toast('Erro ao aprovar solicitação.', 'error'); }
    finally { setBusyId(null); }
  };

  const handleRejectProviderRequest = async (u: User) => {
    setBusyId(u.id);
    try {
      await store.rejectProviderRequest(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, roleRequest: null } : x));
      toast('Solicitação recusada.', 'success');
    } catch (e) { console.error(e); toast('Erro ao recusar solicitação.', 'error'); }
    finally { setBusyId(null); }
  };

  const handleCertify = async (u: User) => {
    setBusyId(u.id);
    try {
      await store.setUserCertified(u.id, !u.isCertified);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isCertified: !u.isCertified } : x));
      toast(u.isCertified ? `Selo removido de ${u.name}.` : `Selo de verificação concedido a ${u.name}.`, 'success');
    } catch (e) { console.error(e); toast('Erro ao alterar o selo.', 'error'); }
    finally { setBusyId(null); }
  };

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
      toast('Permissões RBAC salvas com sucesso.', 'success');
      setEditingPerms(null);
    } catch (e) { console.error(e); toast('Erro ao salvar permissões.', 'error'); }
    finally { setPermBusy(false); }
  };

  const handleAddCategory = async () => {
    if (!newCat.name.trim()) return;
    const slug = newCat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) { toast('Nome de categoria inválido.', 'error'); return; }
    try {
      await store.createCategory({ slug, name: newCat.name.trim(), icon: newCat.icon, sortOrder: categories.length + 1 });
      setNewCat({ name: '', icon: 'Wrench' });
      await loadCategories();
      await refreshCategories();
      toast('Categoria criada.', 'success');
    } catch (e) { console.error(e); toast('Erro ao criar categoria.', 'error'); }
  };

  const handleToggleCategory = async (cat: Category) => {
    try {
      await store.updateCategory(cat.id, { active: !cat.active });
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !c.active } : c));
      await refreshCategories();
    } catch (e) { console.error(e); toast('Erro ao atualizar categoria.', 'error'); }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await store.deleteCategory(cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      await refreshCategories();
      toast('Categoria excluída.', 'success');
    } catch (e) { console.error(e); toast('Erro ao excluir categoria.', 'error'); }
  };

  const handleSaveSettings = async () => {
    const days = parseInt(adDurationDays, 10);
    if (isNaN(days) || days <= 0) { toast('Informe um número válido de dias.', 'error'); return; }
    setBusy(true);
    try {
      await store.setAdDurationDays(days);
      toast('Configurações da plataforma salvas com sucesso.', 'success');
    } catch (e) { console.error(e); toast('Erro ao salvar.', 'error'); }
    finally { setBusy(false); }
  };

  // Filtros aplicados em listas
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (userRoleFilter === 'PROVIDER') return u.role === UserRole.PROVIDER;
    if (userRoleFilter === 'CLIENT') return u.role === UserRole.CLIENT;
    if (userRoleFilter === 'ADMIN') return u.role === UserRole.ADMIN || u.isOwner;
    if (userRoleFilter === 'pending_provider') return u.roleRequest === 'PROVIDER';

    return true;
  });

  const filteredAds = ads.filter(a =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Power BI Card KPI Component
  const PBICard: React.FC<{
    title: string;
    value: string | number;
    subtext?: string;
    trendPct?: string;
    isPositive?: boolean;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    accentColor?: string;
  }> = ({ title, value, subtext, trendPct, isPositive = true, icon: Icon, accentColor = '#F2C811' }) => (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-200 shadow-sm ${
        isDark ? 'bg-slate-800/90 border-slate-700/80 hover:border-slate-600' : 'bg-white border-slate-200/90 hover:border-slate-300'
      }`}
      style={{ borderTop: `4px solid ${accentColor}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">{title}</span>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className={`text-2xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
            {trendPct && (
              <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded ${
                isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {isPositive ? '▲' : '▼'} {trendPct}
              </span>
            )}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-500/10 shrink-0" style={{ color: accentColor }}>
          <Icon size={20} />
        </div>
      </div>
      {subtext && (
        <div className="mt-3 pt-2.5 border-t border-slate-500/10 flex items-center justify-between text-xs text-slate-400">
          <span>{subtext}</span>
          <MiniSparkline color={isPositive ? '#10B981' : '#EF4444'} />
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#F1F5F9] text-slate-900'}`}>

      {/* 🚀 POWER BI TOP HEADER BAR (ALTO CONTRASTE EXECUTIVO ESCURO) */}
      <header className="bg-[#020617] border-b border-slate-800 border-t-4 border-t-[#F2C811] text-white px-4 py-3.5 sticky top-0 z-30 shadow-2xl">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#F2C811] text-[#020617] font-black flex items-center justify-center shadow-lg shrink-0 ring-2 ring-[#F2C811]/20">
              <BarChart2 size={24} strokeWidth={2.8} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Power BI Analytics <span className="text-[#F2C811] text-xs px-2.5 py-0.5 rounded-md bg-[#F2C811]/10 border border-[#F2C811]/30 font-bold uppercase tracking-wider">Mestrio Dashboard</span>
                </h1>
                {user.isOwner ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-extrabold uppercase tracking-wider shadow-sm">Dono Master</span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-extrabold uppercase tracking-wider shadow-sm">Admin</span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                Painel de Controle de Negócios & Métricas ao Vivo
              </p>
            </div>
          </div>

          {/* Quick Actions Header Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <button
              onClick={refreshAllData}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center gap-2 font-bold transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#F2C811]' : ''} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}
            </button>

            <div className="relative group">
              <button
                className="px-4 py-2 rounded-lg bg-[#F2C811] hover:bg-[#d4af0e] text-[#020617] font-black flex items-center gap-2 transition shadow-lg"
              >
                <Download size={14} strokeWidth={2.5} /> Exportar Relatórios
              </button>
              <div className="absolute right-0 mt-1 hidden group-hover:block w-52 bg-[#090D16] border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50">
                <button onClick={handleExportUsers} className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-slate-100 text-xs font-semibold flex items-center gap-2">
                  <Users size={14} className="text-[#F2C811]" /> Exportar Usuários (CSV)
                </button>
                <button onClick={handleExportAds} className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-slate-100 text-xs font-semibold flex items-center gap-2">
                  <Megaphone size={14} className="text-[#F2C811]" /> Exportar Anúncios (CSV)
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#F2C811] border border-slate-700/80 transition shadow-sm"
              title="Alternar Tema Claro/Escuro"
            >
              {isDark ? <Sun size={17} className="text-[#F2C811]" /> : <Moon size={17} className="text-slate-300" />}
            </button>

            <button
              onClick={handleAdminLogout}
              className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold transition shadow-sm flex items-center gap-1.5"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* 🎛️ POWER BI SLICERS / FILTERS TOOLBAR (FUNDO SLATE ESCURO E CONTRASTE) */}
      <section className="bg-[#0B0F17] border-b border-slate-800 text-white px-4 py-3 shadow-inner">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          
          {/* Date Range Slicers */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="font-extrabold text-slate-300 mr-2 flex items-center gap-1 uppercase tracking-wider text-[11px]">
              <Filter size={13} className="text-[#F2C811]" /> Fatiador de Período:
            </span>
            {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3.5 py-1.5 rounded-lg font-extrabold transition text-xs ${
                  dateRange === r
                    ? 'bg-[#F2C811] text-[#0F172A] shadow-md'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {r === '7d' ? 'Últimos 7 dias' : r === '30d' ? 'Últimos 30 dias' : r === '90d' ? 'Últimos 90 dias' : 'Todo o Histórico'}
              </button>
            ))}
          </div>

          {/* Quick Search Filter */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar em relatórios, usuários, anúncios ou categorias..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-xs border border-slate-600 bg-slate-900 text-white placeholder-slate-400 outline-none transition focus:border-[#F2C811] font-medium"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </section>


      {/* 📊 MAIN POWER BI CANVAS */}
      <main className="max-w-[1700px] mx-auto p-4 md:p-6 space-y-6">

        {/* 📑 POWER BI REPORT TABS HEADER */}
        <nav className="flex items-center gap-2 border-b border-slate-500/20 overflow-x-auto pb-1">
          {(['overview', 'ads', 'users', 'reports', 'kyc', 'categories', 'audit', 'broadcasts', 'settings'] as Tab[]).map(t => {
            const labels: Record<Tab, { name: string; icon: any; badge?: number }> = {
              overview: { name: 'Painel Executivo', icon: LayoutDashboard },
              ads: { name: 'Matriz de Anúncios', icon: Megaphone, badge: stats?.adsPending },
              users: { name: 'Usuários & Permissões', icon: Users },
              reports: { name: 'Denúncias & Disputas', icon: ShieldAlert, badge: reports.filter(r => r.status === 'pending').length },
              kyc: { name: 'Validação KYC', icon: ShieldCheck, badge: kycDocs.filter(k => k.status === 'pending').length },
              categories: { name: 'Gestão de Categorias', icon: FolderOpen },
              audit: { name: 'Trilha de Auditoria', icon: FileText },
              broadcasts: { name: 'Central de Comunicados', icon: Bell },
              settings: { name: 'Configurações de Sistema', icon: Settings2 },
            };
            const item = labels[t];
            const isActive = tab === t;

            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-semibold text-xs transition border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-[#F2C811] text-[#F2C811] bg-[#F2C811]/10'
                    : isDark
                    ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {React.createElement(item.icon, { size: 15 })}
                {item.name}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-extrabold bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 1️⃣ OVERVIEW REPORT TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* KPI METRICS SCORECARD ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <PBICard
                title="Total de Usuários"
                value={stats?.totalUsers ?? 0}
                subtext={`${stats?.providers ?? 0} Pro • ${stats?.clients ?? 0} Clientes`}
                trendPct="+14.8%"
                isPositive={true}
                icon={Users}
                accentColor="#3B82F6"
              />
              <PBICard
                title="Anúncios no Ar"
                value={stats?.adsApproved ?? 0}
                subtext={`${stats?.adsPending ?? 0} pendentes de aprovação`}
                trendPct="+8.2%"
                isPositive={true}
                icon={Megaphone}
                accentColor="#10B981"
              />
              <PBICard
                title="Visualizações Totais"
                value={stats?.totalViews ?? 0}
                subtext="Tráfego acumulado em anúncios"
                trendPct="+24.5%"
                isPositive={true}
                icon={Eye}
                accentColor="#8B5CF6"
              />
              <PBICard
                title="Taxa de Eficiência"
                value={`${stats?.totalAppointments ? Math.round((stats.appointmentsCompleted / stats.totalAppointments) * 100) : 100}%`}
                subtext={`${stats?.appointmentsCompleted ?? 0} serviços concluídos`}
                trendPct="+5.1%"
                isPositive={true}
                icon={CheckCircle2}
                accentColor="#F2C811"
              />
            </div>

            {/* VISUAL CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Gráfico de Rosca Power BI: Distribuição de Status */}
              <div className={`rounded-xl border p-5 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <PieChart size={16} className="text-[#F2C811]" /> Moderação & Status de Anúncios
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Distribuição percentual dos cadastros</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">Rosca BI</span>
                </div>
                <StatusDonutChart
                  approved={stats?.adsApproved ?? 0}
                  pending={stats?.adsPending ?? 0}
                  rejected={stats?.adsRejected ?? 0}
                  suspended={stats?.adsSuspended ?? 0}
                  expired={stats?.totalAds ? Math.max(0, stats.totalAds - (stats.adsApproved + stats.adsPending + stats.adsRejected + stats.adsSuspended)) : 0}
                  isDark={isDark}
                />
              </div>

              {/* Gráfico de Linha / Área Power BI: Crescimento & Engajamento */}
              <div className={`lg:col-span-2 rounded-xl border p-5 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <Activity size={16} className="text-[#F2C811]" /> Curva de Crescimento da Plataforma (7 Dias)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Atividade diária de novos cadastros e interações de serviço</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F2C811]" /> Usuários Ativos
                    </span>
                  </div>
                </div>
                <GrowthAreaChart isDark={isDark} />
              </div>
            </div>

            {/* SEGUNDA LINHA DE GRÁFICOS: CATEGORIAS E DESTAQUES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Gráfico de Barras por Categoria */}
              <div className={`rounded-xl border p-5 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <BarChart2 size={16} className="text-[#F2C811]" /> Ranking de Oferta por Categoria
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Volume de anúncios cadastrados em cada nicho</p>
                  </div>
                  <span className="text-xs font-bold text-[#F2C811]">{categories.length} Categorias</span>
                </div>

                {(!stats || stats.adsByCategory.length === 0) ? (
                  <p className="text-xs text-slate-400 py-8 text-center">Nenhum anúncio cadastrado ainda.</p>
                ) : (
                  <div className="space-y-3.5">
                    {stats.adsByCategory.slice(0, 5).map(c => {
                      const max = stats.adsByCategory[0].count || 1;
                      const name = categories.find(cc => cc.slug === c.category)?.name || c.category;
                      const pct = Math.round((c.count / max) * 100);

                      return (
                        <div key={c.category} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{name}</span>
                            <span className="font-mono text-slate-400">{c.count} anúncios ({pct}%)</span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-slate-500/10 overflow-hidden p-0.5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#F2C811] to-amber-500 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Matriz Top Avaliados */}
              <div className={`rounded-xl border p-5 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <Star size={16} className="text-[#F2C811]" /> Anúncios de Maior Desempenho (Top Rated)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Serviços com melhor engajamento e nota média</p>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    <MessageSquare size={12} /> {stats?.totalReviews ?? 0} Avaliações
                  </span>
                </div>

                {(!stats || stats.topAds.length === 0) ? (
                  <p className="text-xs text-slate-400 py-8 text-center">Nenhum anúncio avaliado até o momento.</p>
                ) : (
                  <div className="divide-y divide-slate-500/10">
                    {stats.topAds.slice(0, 4).map((ad, i) => (
                      <div key={ad.id} className="py-3 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 font-black text-xs flex items-center justify-center font-mono">
                          #{i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{ad.title}</p>
                          <p className="text-[11px] text-slate-400">{ad.providerName} • <span className="text-slate-400">{ad.category}</span></p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-1 font-bold text-amber-500 text-xs font-mono">
                            <Star size={12} className="fill-amber-500" /> {ad.rating.toFixed(1)}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                            <Eye size={10} /> {ad.views || 0} views
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 2️⃣ ADS MATRIX MODERATION TAB */}
        {activeTab === 'ads' && (
          <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="p-5 border-b border-slate-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <Megaphone size={18} className="text-[#F2C811]" /> Matriz de Moderação de Anúncios
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Gerenciamento completo de anúncios, aprovações e renovações</p>
              </div>

              {/* Filtros de Status */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['pending', 'approved', 'rejected', 'suspended', 'all'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                      filterStatus === s
                        ? 'bg-[#F2C811] text-slate-950 shadow-sm'
                        : isDark
                        ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s === 'all' ? 'Todos' : STATUS_LABEL[s as AdStatus]}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-500/10">
              {filteredAds.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <Megaphone size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                  Nenhum anúncio encontrado {filterStatus !== 'all' ? `com o status "${STATUS_LABEL[filterStatus as AdStatus]}"` : ''}.
                </div>
              ) : (
                filteredAds.map(ad => (
                  <div key={ad.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-500/5 transition">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{ad.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${STATUS_STYLE[ad.status || 'pending']}`}>
                          {STATUS_LABEL[ad.status || 'pending']}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">{ad.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap font-mono">
                        <span>Profissional: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{ad.providerName}</strong></span>
                        <span>Cat: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{ad.category}</strong></span>
                        <span className="flex items-center gap-1"><Eye size={12} /> {ad.views || 0} views</span>
                        <span className="flex items-center gap-1"><Star size={12} className="text-amber-500 fill-amber-500" /> {ad.rating || 0}</span>
                      </div>
                      {ad.rejectionReason && (
                        <p className="text-xs text-rose-500 flex items-center gap-1 font-semibold mt-1">
                          <AlertTriangle size={13} /> Motivo da Rejeição: {ad.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button onClick={() => setInspectAd(ad)} className="text-xs px-2.5 py-1.5 rounded-md bg-[#F2C811] text-[#1E252B] hover:bg-[#d4af0e] font-bold flex items-center gap-1 transition shadow-sm">
                        <Eye size={12} /> Detalhes & Moderação
                      </button>

                      {ad.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatus(ad, 'approved')} disabled={busyId === ad.id} className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition disabled:opacity-50">
                            <Check size={13} /> Aprovar
                          </button>
                          <button onClick={() => setRejectingId(ad.id)} disabled={busyId === ad.id} className="text-xs px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1 transition disabled:opacity-50">
                            <X size={13} /> Rejeitar
                          </button>
                        </>
                      )}

                      {(ad.status === 'approved' || ad.status === 'expired' || ad.status === 'suspended') && (
                        <>
                          <button onClick={() => handleExtend(ad, 30)} disabled={busyId === ad.id} className="text-xs px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1 transition disabled:opacity-50">
                            <RefreshCw size={12} /> +30 Dias
                          </button>
                          {ad.status === 'approved' && (
                            <button onClick={() => handleStatus(ad, 'suspended')} disabled={busyId === ad.id} className="text-xs px-2.5 py-1.5 rounded-md bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20 font-semibold flex items-center gap-1 transition disabled:opacity-50">
                              <Ban size={12} /> Suspender
                            </button>
                          )}
                        </>
                      )}

                      {ad.status === 'suspended' && (
                        <button onClick={() => handleStatus(ad, 'approved')} disabled={busyId === ad.id} className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition disabled:opacity-50">
                          <Check size={13} /> Reativar
                        </button>
                      )}
                    </div>

                    {rejectingId === ad.id && (
                      <div className="w-full mt-3 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-2">
                        <label className="block text-xs font-bold text-rose-400">Informe o motivo da rejeição para o usuário:</label>
                        <input
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Ex: Fotos inadequadas, descrição incompleta..."
                          className={`w-full text-xs px-3 py-2 rounded border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleStatus(ad, 'rejected', rejectReason.trim() || 'Não atende às diretrizes da plataforma')} disabled={busyId === ad.id} className="text-xs px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition">
                            Confirmar Rejeição
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3️⃣ USERS & RBAC DIRECTORY TAB */}
        {activeTab === 'users' && (
          <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="p-5 border-b border-slate-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <Users size={18} className="text-[#F2C811]" /> Diretório de Usuários & Controle de Acessos
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Gerencie e filtre usuários por perfil, selos de verificação e permissões</p>
              </div>

              {/* Botões de Classificação por Papel (Slicers Power BI) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'PROVIDER', 'CLIENT', 'ADMIN', 'pending_provider'] as const).map(role => {
                  const counts = {
                    all: users.length,
                    PROVIDER: users.filter(u => u.role === UserRole.PROVIDER).length,
                    CLIENT: users.filter(u => u.role === UserRole.CLIENT).length,
                    ADMIN: users.filter(u => u.role === UserRole.ADMIN || u.isOwner).length,
                    pending_provider: users.filter(u => u.roleRequest === 'PROVIDER').length,
                  };
                  const labels = {
                    all: 'Todos',
                    PROVIDER: 'Profissionais',
                    CLIENT: 'Clientes',
                    ADMIN: 'Admins',
                    pending_provider: 'Solicitações Pro',
                  };

                  return (
                    <button
                      key={role}
                      onClick={() => setUserRoleFilter(role)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                        userRoleFilter === role
                          ? 'bg-[#F2C811] text-slate-950 shadow-md'
                          : isDark
                          ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {labels[role]}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                        userRoleFilter === role ? 'bg-slate-900/20 text-slate-950' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {counts[role]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-slate-500/10">
              {filteredUsers.map(u => (
                <div key={u.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-500/5 transition">
                  <div className="flex items-center gap-3">
                    <img loading="lazy" decoding="async" src={u.avatar || 'https://via.placeholder.com/50'} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-slate-500/20" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.name}</span>
                        {u.isOwner && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">Dono</span>
                        )}
                        {u.isCertified && u.role === UserRole.PROVIDER && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                            <CheckCircle2 size={10} /> Verificado
                          </span>
                        )}
                        {u.role === UserRole.ADMIN && !u.isOwner && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">Admin</span>
                        )}
                        {u.role === UserRole.PROVIDER && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">Profissional</span>
                        )}
                        {u.role === UserRole.CLIENT && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30 font-bold">Cliente</span>
                        )}
                        {u.isSuspended && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">Suspenso</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</p>
                    </div>
                  </div>

                  {/* Botões de Ações de Usuário */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0 text-xs">
                    <button onClick={() => setInspectUser(u)} className="px-2.5 py-1.5 rounded bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 font-semibold flex items-center gap-1 transition">
                      <Eye size={12} /> Detalhes do Usuário
                    </button>
                    {u.roleRequest === 'PROVIDER' && can('approve_providers') && (
                      <div className="flex gap-1">
                        <button onClick={() => handleApproveProviderRequest(u)} disabled={busyId === u.id} className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1">
                          <Check size={12} /> Aprovar Pro
                        </button>
                        <button onClick={() => handleRejectProviderRequest(u)} disabled={busyId === u.id} className="px-2 py-1.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 font-bold">
                          Recusar
                        </button>
                      </div>
                    )}

                    {user.isOwner && !u.isOwner && (
                      u.role === UserRole.ADMIN ? (
                        <>
                          <button onClick={() => openPermModal(u)} className="px-2.5 py-1.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 font-semibold flex items-center gap-1">
                            <Shield size={12} /> Permissões RBAC
                          </button>
                          <button onClick={() => handleDemote(u.id)} className="px-2.5 py-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-semibold">
                            Remover Admin
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handlePromote(u.id)} className="px-2.5 py-1.5 rounded bg-[#F2C811]/20 text-[#F2C811] border border-[#F2C811]/30 hover:bg-[#F2C811]/30 font-bold flex items-center gap-1">
                          <Shield size={12} /> Promover a Admin
                        </button>
                      )
                    )}

                    {u.role === UserRole.PROVIDER && !u.isOwner && can('verify_providers') && (
                      <button
                        onClick={() => handleCertify(u)}
                        disabled={busyId === u.id}
                        className={`px-2.5 py-1.5 rounded border font-semibold flex items-center gap-1 ${
                          u.isCertified
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                        }`}
                      >
                        <CheckCircle2 size={12} /> {u.isCertified ? 'Remover Selo' : 'Dar Selo Pro'}
                      </button>
                    )}

                    {!u.isOwner && u.id !== user.id && can('manage_users') && (
                      <button
                        onClick={() => handleSuspend(u)}
                        className={`px-2.5 py-1.5 rounded border font-semibold flex items-center gap-1 ${
                          u.isSuspended
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                        }`}
                      >
                        <Ban size={12} /> {u.isSuspended ? 'Reativar' : 'Suspender'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4️⃣ REPORTS & DISPUTES TAB */}
        {activeTab === 'reports' && (
          <div className={`rounded-xl border shadow-sm p-6 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <ShieldAlert size={18} className="text-rose-400" /> Denúncias & Disputas
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Gerencie denúncias de usuários contra profissionais ou anúncios</p>
              </div>
              <div className="flex gap-1.5">
                {(['pending', 'resolved', 'dismissed', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setReportFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                      reportFilter === f
                        ? 'bg-[#F2C811] text-slate-950'
                        : isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'resolved' ? 'Resolvidas' : 'Arquivadas'}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-500/10">
              {reports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center">Nenhuma denúncia encontrada nesta categoria.</p>
              ) : (
                reports
                  .filter(r => reportFilter === 'all' || r.status === reportFilter)
                  .map(report => (
                    <div key={report.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border uppercase ${
                              report.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>{report.status === 'pending' ? 'Pendente' : report.status === 'resolved' ? 'Resolvida' : 'Arquivada'}</span>
                            <span className="text-xs font-bold text-[#F2C811]">{report.reason}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 font-mono`}>{report.targetType}</span>
                          </div>
                          <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            Alvo: {report.targetTitle || report.targetId}
                          </p>
                          {report.details && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{report.details}</p>
                          )}
                          <p className="text-[11px] text-slate-500 mt-1 font-mono">
                            Por: {report.reporterName || report.reporterId} • {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      {report.status === 'pending' && (
                        <div className="flex gap-2 shrink-0 text-xs">
                          <button
                            onClick={async () => {
                              try {
                                await store.updateReportStatus(report.id, 'resolved');
                                loadReports();
                                toast('Denúncia marcada como resolvida.', 'success');
                              } catch { toast('Erro ao atualizar denúncia.', 'error'); }
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                          >
                            <Check size={13} /> Resolver
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await store.updateReportStatus(report.id, 'dismissed');
                                loadReports();
                                toast('Denúncia arquivada.', 'info');
                              } catch { toast('Erro ao arquivar denúncia.', 'error'); }
                            }}
                            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold"
                          >
                            Arquivar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* 5️⃣ KYC VALIDATION TAB */}
        {activeTab === 'kyc' && (
          <div className={`rounded-xl border shadow-sm p-6 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <ShieldCheck size={18} className="text-emerald-400" /> Validação KYC de Profissionais
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Analise documentos enviados para concessão do Selo de Verificado</p>
              </div>
              <div className="flex gap-1.5">
                {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setKycFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                      kycFilter === f
                        ? 'bg-[#F2C811] text-slate-950'
                        : isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovados' : 'Rejeitados'}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-500/10">
              {kycDocs.filter(k => kycFilter === 'all' || k.status === kycFilter).length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center">Nenhum documento KYC nesta categoria.</p>
              ) : (
                kycDocs
                  .filter(k => kycFilter === 'all' || k.status === kycFilter)
                  .map(doc => (
                    <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border uppercase ${
                              doc.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>{doc.status === 'pending' ? 'Pendente' : doc.status === 'approved' ? 'Aprovado' : 'Rejeitado'}</span>
                            <span className="text-xs font-bold text-slate-300">{doc.documentType}</span>
                            <span className="text-xs font-mono text-slate-400">{doc.documentNumber}</span>
                          </div>
                          <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            Usuário: {doc.userName} &bull; <span className="text-slate-400 font-normal">{doc.userEmail}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 font-mono">
                            Enviado em: {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                          {doc.rejectionReason && (
                            <p className="text-xs text-rose-400 mt-0.5">Motivo de Rejeição: {doc.rejectionReason}</p>
                          )}
                          {doc.documentFrontUrl && (
                            <a
                              href={doc.documentFrontUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#F2C811] hover:underline mt-1 inline-flex items-center gap-1"
                            >
                              <Eye size={12} /> Ver Documento
                            </a>
                          )}
                        </div>
                      {doc.status === 'pending' && (
                        <div className="flex gap-2 shrink-0 text-xs">
                          <button
                            onClick={async () => {
                              try {
                                await store.verifyKYCDocument(doc.id, 'approved');
                                await store.setUserCertified(doc.userId, true);
                                setUsers(prev => prev.map(x => x.id === doc.userId ? { ...x, isCertified: true } : x));
                                loadKYCDocs();
                                toast('KYC aprovado — Selo de Verificado concedido!', 'success');
                              } catch { toast('Erro ao aprovar KYC.', 'error'); }
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                          >
                            <ShieldCheck size={13} /> Aprovar & Verificar
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await store.verifyKYCDocument(doc.id, 'rejected');
                                loadKYCDocs();
                                toast('Documento KYC rejeitado.', 'info');
                              } catch { toast('Erro ao rejeitar KYC.', 'error'); }
                            }}
                            className="px-3 py-1.5 rounded bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30 font-bold"
                          >
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* 6️⃣ CATEGORIES MANAGEMENT TAB */}
        {activeTab === 'categories' && (
          <div className={`rounded-xl border shadow-sm p-6 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-base font-bold flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <FolderOpen size={18} className="text-[#F2C811]" /> Gestão de Categorias do Sistema
            </h2>

            {/* Criar Nova Categoria */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-xl border border-slate-500/20 bg-slate-500/5">
              <input
                value={newCat.name}
                onChange={e => setNewCat(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome da categoria (ex: Reformas & Pintura)"
                className={`flex-1 text-xs px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
              />
              <input
                value={newCat.icon}
                onChange={e => setNewCat(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="Ícone Lucide (ex: Wrench)"
                className={`sm:w-48 text-xs px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
              />
              <button onClick={handleAddCategory} className="px-4 py-2 bg-[#F2C811] hover:bg-[#d4af0e] text-[#1E252B] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition">
                <Plus size={15} /> Adicionar Categoria
              </button>
            </div>

            {/* Grid de Categorias Existentes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F2C811]/10 text-[#F2C811] font-bold flex items-center justify-center">
                      <FolderOpen size={18} />
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cat.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">/{cat.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleCategory(cat)}
                      className={`text-[10px] px-2 py-1 rounded font-bold ${
                        cat.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </button>
                    <button onClick={() => handleDeleteCategory(cat)} className="p-1 text-rose-400 hover:text-rose-300">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5️⃣ AUDIT LOGS TRAIL TAB */}
        {activeTab === 'audit' && (
          <div className={`rounded-xl border shadow-sm p-6 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <FileText size={18} className="text-[#F2C811]" /> Trilha de Logs de Auditoria do Sistema
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Histórico imutável de todas as ações administrativas executadas no painel</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-slate-500/10 text-slate-400">
                {auditLogs.length} Registros Gravações
              </span>
            </div>

            <div className="divide-y divide-slate-500/10">
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">Nenhum log registrado até o momento.</div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#F2C811] font-mono">{log.action}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 font-mono">
                          {log.targetType || 'Sistema'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{log.details}</p>
                      <p className="text-[11px] text-slate-400">Admin responsável: {log.adminEmail}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6️⃣ SYSTEM BROADCASTS TAB */}
        {activeTab === 'broadcasts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulário de Novo Comunicado */}
            <div className={`rounded-xl border p-6 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Bell size={18} className="text-[#F2C811]" /> Publicar Comunicado
              </h2>
              <p className="text-xs text-slate-400 mb-4">Avisos globais para exibição imediata nos dashboards dos usuários.</p>

              <form onSubmit={handleCreateBroadcast} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Título do Aviso *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Manutenção Programada ou Novas Regras"
                    value={bcTitle}
                    onChange={e => setBcTitle(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Público Alvo</label>
                  <select
                    value={bcTarget}
                    onChange={e => setBcTarget(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  >
                    <option value="ALL">Todos os Usuários</option>
                    <option value="CLIENT">Somente Clientes</option>
                    <option value="PROVIDER">Somente Profissionais</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Mensagem *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Escreva a mensagem oficial..."
                    value={bcMessage}
                    onChange={e => setBcMessage(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={bcBusy}
                  className="w-full py-2.5 bg-[#F2C811] hover:bg-[#d4af0e] text-[#1E252B] font-bold rounded-lg transition disabled:opacity-50"
                >
                  {bcBusy ? 'Publicando...' : 'Publicar Broadcast'}
                </button>
              </form>
            </div>

            {/* Lista de Comunicados Ativos */}
            <div className={`lg:col-span-2 rounded-xl border p-6 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Histórico de Comunicados</h3>

              <div className="divide-y divide-slate-500/10">
                {broadcasts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">Nenhum comunicado criado até agora.</p>
                ) : (
                  broadcasts.map(bc => (
                    <div key={bc.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{bc.title}</span>
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-semibold">
                            {bc.targetRole === 'ALL' ? 'Todos' : bc.targetRole === 'CLIENT' ? 'Clientes' : 'Profissionais'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{bc.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                          Publicado em {new Date(bc.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleBroadcast(bc.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
                          bc.active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {bc.active ? 'Ativo (Exibindo)' : 'Inativo (Oculto)'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* 7️⃣ SETTINGS CONFIGURATION TAB */}
        {activeTab === 'settings' && (
          <div className={`max-w-xl rounded-xl border p-6 shadow-sm ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-base font-bold flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Settings2 size={18} className="text-[#F2C811]" /> Configurações Gerais do Sistema
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Validade Padrão dos Anúncios (Dias)</label>
                <input
                  type="number"
                  min={1}
                  value={adDurationDays}
                  onChange={e => setAdDurationDays(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                />
                <p className="text-[11px] text-slate-400 mt-1">Período que um anúncio aprovado permanece ativo antes de expirar automaticamente.</p>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={busy}
                className="px-4 py-2 bg-[#F2C811] hover:bg-[#d4af0e] text-[#1E252B] font-bold rounded-lg transition disabled:opacity-50"
              >
                {busy ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* 🔐 MODAL DE PERMISSÕES RBAC PARA ADMINS */}
      {editingPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className={`rounded-xl border shadow-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className="text-base font-bold mb-1 flex items-center gap-2">
              <Shield size={18} className="text-[#F2C811]" /> Permissões RBAC para {editingPerms.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">Selecione os módulos administrativos aos quais este administrador terá acesso.</p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                  isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(key)}
                    onChange={e => setSelectedPerms(prev => e.target.checked ? [...prev, key] : prev.filter(p => p !== key))}
                    className="w-4 h-4 text-[#F2C811] accent-[#F2C811] rounded"
                  />
                  <span className="text-xs font-medium">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6 text-xs">
              <button
                onClick={() => setEditingPerms(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePerms}
                disabled={permBusy}
                className="px-4 py-2 rounded-lg bg-[#F2C811] hover:bg-[#d4af0e] text-[#1E252B] font-bold transition disabled:opacity-50"
              >
                {permBusy ? 'Salvando...' : 'Salvar Permissões'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 MODAL DE INSPEÇÃO COMPLETA DE ANÚNCIO & PROFISSIONAL */}
      {inspectAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className={`rounded-2xl border shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-6 ${
            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b pb-4 border-slate-500/20">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${STATUS_STYLE[inspectAd.status || 'pending']}`}>
                    {STATUS_LABEL[inspectAd.status || 'pending']}
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {inspectAd.id}</span>
                </div>
                <h2 className="text-xl font-extrabold">{inspectAd.title}</h2>
              </div>
              <button onClick={() => setInspectAd(null)} className="p-1 rounded-lg hover:bg-slate-500/20 text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {/* Grid: Dados do Anúncio + Dados do Profissional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Seção Anúncio */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs text-[#F2C811] uppercase tracking-wider flex items-center gap-1.5">
                  <Megaphone size={16} /> Detalhes do Anúncio
                </h3>

                {/* Fotos */}
                {inspectAd.images && inspectAd.images.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Fotos Anexadas ({inspectAd.images.length}):</p>
                    <div className="grid grid-cols-3 gap-2">
                      {inspectAd.images.map((img, i) => (
                        <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-slate-500/20 block">
                          <img src={img} alt="Foto Anúncio" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma imagem anexada.</p>
                )}

                <div className="space-y-2 text-xs">
                  <p><strong>Categoria:</strong> <span className="font-semibold text-[#F2C811]">{inspectAd.category}</span></p>
                  <p><strong>Preço:</strong> <span className="font-bold">R$ {inspectAd.price?.toLocaleString('pt-BR')}</span> ({inspectAd.priceUnit === 'job' ? 'Por Serviço' : inspectAd.priceUnit === 'hour' ? 'Por Hora' : 'Orçamento'})</p>
                  <p><strong>Localização:</strong> {inspectAd.location || 'Não informada'}</p>
                  <p>
                    <strong>WhatsApp:</strong>{' '}
                    <a href={`https://wa.me/${inspectAd.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-emerald-500 underline font-mono hover:text-emerald-400">
                      {inspectAd.whatsapp}
                    </a>
                  </p>
                  <p><strong>Disponibilidade:</strong> {inspectAd.availability || 'Não especificada'}</p>
                  {inspectAd.tags && inspectAd.tags.length > 0 && (
                    <div>
                      <strong>Tags:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {inspectAd.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-300 text-[11px] font-medium">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Descrição Completa:</p>
                  <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto ${
                    isDark ? 'bg-slate-900/60 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    {inspectAd.description}
                  </div>
                </div>
              </div>

              {/* Seção Profissional */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs text-[#F2C811] uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={16} /> Perfil do Profissional
                </h3>

                {(() => {
                  const providerUser = users.find(u => u.id === inspectAd.providerId);
                  return (
                    <div className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <img src={providerUser?.avatar || 'https://via.placeholder.com/60'} alt={inspectAd.providerName} className="w-12 h-12 rounded-full object-cover ring-2 ring-[#F2C811]/30" />
                        <div>
                          <h4 className="font-bold text-sm flex items-center gap-1.5">
                            {inspectAd.providerName}
                            {providerUser?.isCertified && <span title="Verificado"><CheckCircle2 size={14} className="text-emerald-500" /></span>}
                          </h4>
                          <p className="text-xs text-slate-400 font-mono">{providerUser?.email || 'E-mail do perfil'}</p>
                        </div>
                      </div>

                      <div className="text-xs space-y-1.5 pt-2 border-t border-slate-500/10">
                        <p><strong>ID do Usuário:</strong> <span className="font-mono text-[11px] text-slate-400">{inspectAd.providerId}</span></p>
                        <p><strong>Tipo de Conta:</strong> <span className="font-semibold text-emerald-400">{providerUser?.role || 'PROVIDER'}</span></p>
                        <p><strong>Selo de Verificação:</strong> {providerUser?.isCertified ? '✅ Selo Concedido' : '❌ Não Verificado'}</p>
                        <p><strong>Total de Anúncios no Perfil:</strong> {ads.filter(a => a.providerId === inspectAd.providerId).length}</p>
                      </div>

                      {providerUser && (
                        <button
                          onClick={() => {
                            setInspectUser(providerUser);
                            setInspectAd(null);
                          }}
                          className="w-full py-1.5 text-xs rounded bg-slate-500/20 hover:bg-slate-500/30 text-slate-200 font-semibold transition"
                        >
                          Ver Perfil Completo do Usuário →
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Ações de Moderação no próprio Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-500/20 gap-3 flex-wrap">
              <button onClick={() => setInspectAd(null)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 font-semibold text-xs transition">
                Fechar
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {inspectAd.status === 'pending' && (
                  <>
                    <button
                      onClick={async () => {
                        await handleStatus(inspectAd, 'approved');
                        setInspectAd(null);
                      }}
                      disabled={busyId === inspectAd.id}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                    >
                      <Check size={14} /> Aprovar Anúncio
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(inspectAd.id);
                        setInspectAd(null);
                      }}
                      disabled={busyId === inspectAd.id}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                    >
                      <X size={14} /> Rejeitar Anúncio
                    </button>
                  </>
                )}

                {inspectAd.status === 'approved' && (
                  <button
                    onClick={async () => {
                      await handleExtend(inspectAd, 30);
                      setInspectAd(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <RefreshCw size={14} /> +30 Dias de Validade
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 MODAL DE INSPEÇÃO COMPLETA DE USUÁRIO */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className={`rounded-2xl border shadow-2xl max-w-lg w-full p-6 space-y-6 ${
            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-start justify-between border-b pb-4 border-slate-500/20">
              <div className="flex items-center gap-3">
                <img src={inspectUser.avatar || 'https://via.placeholder.com/60'} alt={inspectUser.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-[#F2C811]/40" />
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-1.5">
                    {inspectUser.name}
                    {inspectUser.isCertified && <CheckCircle2 size={16} className="text-emerald-500" />}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{inspectUser.email}</p>
                </div>
              </div>
              <button onClick={() => setInspectUser(null)} className="p-1 rounded-lg hover:bg-slate-500/20 text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p><strong>ID:</strong> <span className="font-mono text-slate-400">{inspectUser.id}</span></p>
              <p><strong>Papel (Role):</strong> <span className="font-bold text-[#F2C811]">{inspectUser.role}</span> {inspectUser.isOwner && '(Dono Master)'}</p>
              <p><strong>Telefone / WhatsApp:</strong> {inspectUser.phone || 'Não informado'}</p>
              <p><strong>Localização / Região:</strong> {inspectUser.location || 'Não informada'}</p>
              <p><strong>Documento (CPF/CNPJ):</strong> {inspectUser.documentNumber || 'Não informado'}</p>
              <p><strong>Selo de Verificação:</strong> {inspectUser.isCertified ? '✅ Verificado' : '❌ Não Verificado'}</p>
              <p><strong>Solicitação de Função:</strong> {inspectUser.roleRequest === 'PROVIDER' ? '🟡 Solicitou virar Profissional' : 'Nenhuma'}</p>
              {inspectUser.bio && (
                <div>
                  <strong>Biografia / Apresentação do Trabalho:</strong>
                  <div className={`mt-1 p-2.5 rounded border leading-relaxed ${isDark ? 'bg-slate-900/60 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                    {inspectUser.bio}
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Anúncios deste Usuário */}
            <div>
              <p className="text-xs font-bold text-slate-400 mb-2">Anúncios do Usuário ({ads.filter(a => a.providerId === inspectUser.id).length}):</p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {ads.filter(a => a.providerId === inspectUser.id).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum anúncio publicado.</p>
                ) : (
                  ads.filter(a => a.providerId === inspectUser.id).map(a => (
                    <div key={a.id} className="p-2.5 rounded-lg border border-slate-500/20 flex items-center justify-between text-xs">
                      <span className="font-semibold truncate max-w-[200px]">{a.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[a.status || 'pending']}`}>
                        {STATUS_LABEL[a.status || 'pending']}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-500/20 gap-2 flex-wrap">
              <button onClick={() => setInspectUser(null)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 font-semibold text-xs transition">
                Fechar
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {inspectUser.roleRequest === 'PROVIDER' && can('approve_providers') && (
                  <button
                    onClick={async () => {
                      await handleApproveProviderRequest(inspectUser);
                      setInspectUser(null);
                    }}
                    disabled={busyId === inspectUser.id}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Check size={14} /> Aprovar como Profissional
                  </button>
                )}

                {inspectUser.role === UserRole.PROVIDER && !inspectUser.isCertified && can('verify_providers') && (
                  <button
                    onClick={async () => {
                      await store.setUserCertified(inspectUser.id, true);
                      setUsers(prev => prev.map(x => x.id === inspectUser.id ? { ...x, isCertified: true } : x));
                      toast('Selo de Verificação concedido!', 'success');
                      setInspectUser(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition"
                  >
                    <ShieldCheck size={14} /> Conceder Selo de Verificação
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerDashboard;
