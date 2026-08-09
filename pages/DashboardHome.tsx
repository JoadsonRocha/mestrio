import React, { useEffect, useState } from 'react';
import { store } from '../services/store';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, MessageSquare, Calendar, Star, CheckCircle2, Megaphone, Mail, Briefcase, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ServiceAd, UserRole, Appointment, ChatSession } from '../types';

const DashboardHome: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [myAds, setMyAds] = useState<ServiceAd[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [requesting, setRequesting] = useState(false);

  const handleRequestProvider = async () => {
    setRequesting(true);
    try {
      await store.requestProviderRole();
      await refreshUser();
      toast('Solicitação enviada! Aguardando aprovação.', 'success');
    } catch (e: any) {
      console.error(e);
      toast(e?.message || 'Erro ao solicitar.', 'error');
    }
    finally { setRequesting(false); }
  };

  const handleCancelProviderRequest = async () => {
    setRequesting(true);
    try {
      await store.cancelProviderRequest();
      await refreshUser();
      toast('Solicitação cancelada.', 'info');
    } catch (e) { console.error(e); toast('Erro ao cancelar.', 'error'); }
    finally { setRequesting(false); }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
        navigate('/login');
        return;
    }

    const loadAll = async () => {
      const userAppointments = await store.getMyAppointments(user.id, user.role);
      setAppointments(userAppointments);
      const userChats = await store.getChats(user.id);
      setChats(userChats);
      if (user.role === UserRole.PROVIDER) {
        const ads = await store.getAds({ providerId: user.id });
        setMyAds(ads);
      }
    };
    loadAll();
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  const isClient = user.role === UserRole.CLIENT;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const enquiriesTotal = chats.length;
  const enquiriesNew = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const enquiriesWeek = chats.filter(c => new Date(c.updatedAt) >= weekAgo).length;
  const enquiriesResolved = appointments.filter(a => a.status === 'completed').length;

  const adsTotal = myAds.length;
  const adsPremium = myAds.filter(a => a.isPremium).length;
  const adsCategories = new Set(myAds.map(a => a.category)).size;
  const adsRating = myAds.length ? (myAds.reduce((acc, a) => acc + (a.rating || 0), 0) / myAds.length).toFixed(1) : '0';

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

  const SectionHeader: React.FC<{ title: string; to: string; linkText: string }> = ({ title, to, linkText }) => (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <Link to={to} className="text-brand-600 font-medium text-sm hover:underline">{linkText} →</Link>
    </div>
  );

  return (
    <div className="h-full">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-bold text-gray-900">Meu Painel</h1>
            {!isClient && (
                <Link to="/create-ad" className="bg-brand-600 text-white px-3 py-1.5 text-sm rounded-md flex items-center hover:bg-brand-700">
                    <Plus size={16} className="mr-1" /> Novo Anúncio
                </Link>
            )}
        </div>

        {isClient && (
          user.roleRequest === 'PROVIDER' ? (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Briefcase size={20} className="text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-800 text-sm">Solicitação de profissional enviada</p>
                <p className="text-xs text-yellow-700">Assim que o dono da plataforma aprovar, você poderá criar anúncios de serviços.</p>
              </div>
              <button
                onClick={handleCancelProviderRequest}
                disabled={requesting}
                className="text-xs px-3 py-1.5 rounded-md bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50 flex items-center"
              >
                <X size={12} className="mr-1" /> Cancelar solicitação
              </button>
            </div>
          ) : (
            <div className="mb-6 bg-brand-50 border border-brand-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Briefcase size={20} className="text-brand-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-brand-900 text-sm">Quer anunciar seus serviços?</p>
                <p className="text-xs text-brand-700">Torne-se um profissional e crie anúncios de serviços para atrair clientes.</p>
              </div>
              <button
                onClick={handleRequestProvider}
                disabled={requesting}
                className="text-xs px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center"
              >
                <Briefcase size={12} className="mr-1" /> Quero ser profissional
              </button>
            </div>
          )
        )}

        {/* Meus Serviços */}
        <div className="mb-6">
            <SectionHeader title="Meus Serviços" to="/dashboard/appointments" linkText="Ver todos" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total de Consultas" value={enquiriesTotal} icon={MessageSquare} color="bg-brand-50 text-brand-600" />
                <StatCard label="Novas Mensagens" value={enquiriesNew} icon={Mail} color="bg-green-50 text-green-600" />
                <StatCard label="Esta Semana" value={enquiriesWeek} icon={Calendar} color="bg-blue-50 text-blue-600" />
                <StatCard label="Total Resolvidas" value={enquiriesResolved} icon={CheckCircle2} color="bg-purple-50 text-purple-600" />
            </div>
        </div>

        {/* Meus Anúncios (apenas profissional) */}
        {!isClient && (
            <div className="mb-6">
                <SectionHeader title="Meus Anúncios" to="/dashboard/ads" linkText="Ver todos" />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard label="Total de Anúncios" value={adsTotal} icon={Megaphone} color="bg-brand-50 text-brand-600" />
                    <StatCard label="Anúncios Premium" value={adsPremium} icon={Star} color="bg-yellow-50 text-yellow-600" />
                    <StatCard label="Categorias" value={adsCategories} icon={Search} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Avaliação Média" value={adsRating} icon={Star} color="bg-purple-50 text-purple-600" />
                </div>
            </div>
        )}
    </div>
  );
};

export default DashboardHome;
