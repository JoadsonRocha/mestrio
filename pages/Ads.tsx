import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Clock, Star, Megaphone, TrendingUp, Rocket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { store } from '../services/store';
import { ServiceAd, UserRole } from '../types';
import { ServiceCard } from '../components/UI';
import { useToast } from '../context/ToastContext';
import { BoostAdModal } from '../components/BoostAdModal';

const Ads: React.FC = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [ads, setAds] = useState<ServiceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [boostingAd, setBoostingAd] = useState<ServiceAd | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      await store.expireAds().catch(() => undefined);
      const data = await store.getAds({ providerId: user.id });
      setAds(data);
    } catch (e) {
      console.error("Erro ao carregar anúncios:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== UserRole.PROVIDER) {
      navigate('/dashboard');
      return;
    }
    load();
  }, [user, loading, navigate, load]);

  const handleDelete = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      window.setTimeout(() => setConfirmingId(prev => prev === id ? null : prev), 3000);
      return;
    }
    setDeletingId(id);
    try {
      await store.deleteAd(id);
      setAds(prev => prev.filter(ad => ad.id !== id));
      toast('Anúncio excluído com sucesso.', 'success');
    } catch (e) {
      console.error("Erro ao excluir anúncio:", e);
      toast('Não foi possível excluir o anúncio.', 'error');
    } finally {
      setConfirmingId(null);
      setDeletingId(null);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <Clock className="animate-spin text-brand-600" size={32} />
      </div>
    );
  }

  const totalAds = ads.length;
  const premiumAds = ads.filter(a => a.isPremium).length;
  const categories = new Set(ads.map(a => a.category)).size;
  const avgRating = ads.length
    ? (ads.reduce((acc, a) => acc + (a.rating || 0), 0) / ads.length).toFixed(1)
    : '0';

  const stats = [
    { label: 'Total de Anúncios', value: totalAds, icon: Megaphone, color: 'bg-brand-50 text-brand-600' },
    { label: 'Anúncios Premium', value: premiumAds, icon: Star, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Categorias', value: categories, icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
    { label: 'Avaliação Média', value: avgRating, icon: Star, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="h-full p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meus Anúncios</h1>
          <Link to="/create-ad" className="bg-brand-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center hover:bg-brand-700 transition-colors">
            <Plus size={16} className="mr-1.5" /> Novo Anúncio
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ads List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Seus Anúncios ({ads.length})</h2>
          </div>

          {ads.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Megaphone size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">Nenhum anúncio publicado ainda.</p>
              <p className="text-gray-400 text-sm mt-1">Comece a divulgar seus serviços e conquiste novos clientes hoje mesmo!</p>
              <Link to="/create-ad" className="inline-block mt-4 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-xs">
                Criar meu primeiro anúncio
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-5">
              {ads.map(ad => (
                <div key={ad.id} className="bg-white rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between">
                  {/* Status de Moderação no topo */}
                  {ad.status && ad.status !== 'approved' && (
                    <div className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between border-b ${
                      ad.status === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      ad.status === 'rejected' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                      ad.status === 'suspended' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                      'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        {ad.status === 'pending' ? 'Em análise de segurança' :
                         ad.status === 'rejected' ? 'Anúncio rejeitado' :
                         ad.status === 'suspended' ? 'Anúncio suspenso' : 'Anúncio expirado'}
                      </span>
                      {ad.rejectionReason && (
                        <span className="text-[10px] opacity-80 truncate max-w-[140px]" title={ad.rejectionReason}>
                          {ad.rejectionReason}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Prévia do Card */}
                  <div className="flex-1">
                    <ServiceCard ad={ad} compact />
                  </div>

                  {/* Barra de Ações Dedicada */}
                  <div className="bg-gray-50/90 p-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Link
                      to={`/edit-ad/${ad.id}`}
                      className="flex-1 text-center bg-white hover:bg-gray-100 text-gray-700 text-xs py-1.5 px-2 rounded-lg font-bold border border-gray-200 transition shadow-2xs"
                    >
                      Editar
                    </Link>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setBoostingAd(ad);
                      }}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center shadow-2xs"
                      title="Destacar no topo da categoria"
                    >
                      <Rocket size={12} className="mr-1 shrink-0" />
                      <span>{ad.isPremium ? 'Turbinado' : 'Turbinar'}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(ad.id);
                      }}
                      disabled={deletingId === ad.id}
                      className={`text-xs py-1.5 px-2.5 rounded-lg font-bold transition flex items-center justify-center shrink-0 ${
                        confirmingId === ad.id
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-rose-50 text-rose-600 border border-gray-200'
                      }`}
                      title="Excluir anúncio"
                    >
                      <Trash2 size={13} className={confirmingId === ad.id ? 'mr-1' : ''} />
                      {confirmingId === ad.id && (deletingId === ad.id ? '...' : 'Confirmar?')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Modal de Destaque Patrocinado */}
      {boostingAd && (
        <BoostAdModal
          isOpen={!!boostingAd}
          ad={boostingAd}
          onClose={() => setBoostingAd(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
};

export default Ads;
