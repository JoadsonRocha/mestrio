import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { store } from '../services/store';
import { User, ServiceAd, BeforeAfterProject } from '../types';
import { ServiceCard } from '../components/UI';
import { MessageSquare, MapPin, Star, CheckCircle2, User as UserIcon, QrCode, Sparkles, Award, Share2, Copy, Check, MessageCircle, Globe, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DigitalBusinessCardModal } from '../components/DigitalBusinessCardModal';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { getBusinessStatus } from '../utils/businessHours';
import { MultiCriteriaBreakdown } from '../components/MultiCriteriaReviewWidget';
import { SocialShareModal } from '../components/SocialShareModal';

const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<User | null>(null);
  const [ads, setAds] = useState<ServiceAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBusinessCard, setShowBusinessCard] = useState(false);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleShareProfile = () => {
    setShowSocialShare(true);
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const p = await store.getUserProfile(id);
        setProfile(p);
        
        if (p) {
            const userAds = await store.getAds({ providerId: id });
            setAds(userAds);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [id]);

  const handleStartChat = async (adId: string) => {
    if (!user) {
        navigate('/login');
        return;
    }
    if (user.id === id) return; // Can't chat with self

    try {
        const chatId = await store.startChat(user.id, id!, adId, '');
        navigate(`/dashboard/chat/${chatId}`);
    } catch (e) {
        console.error(e);
        toast("Erro ao iniciar chat.", 'error');
    }
  };

  if (loading) {
      return (
          <div className="flex-1 flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
      );
  }

  if (!profile) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
              <UserIcon size={48} className="text-gray-300 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Perfil não encontrado</h2>
              <p className="text-gray-500">Este usuário não existe ou foi removido.</p>
          </div>
      );
  }

  const averageRating = ads.length > 0 
      ? (ads.reduce((acc, ad) => acc + ad.rating, 0) / ads.length).toFixed(1)
      : '0.0';
      
  const totalReviews = ads.reduce((acc, ad) => acc + ad.reviewCount, 0);
  const allReviews = ads.flatMap(ad => ad.reviews || []);

  // Projetos Antes/Depois do perfil ou amostra profissional
  const beforeAfterProjects: BeforeAfterProject[] = profile.beforeAfterProjects && profile.beforeAfterProjects.length > 0
    ? profile.beforeAfterProjects
    : [
        {
          id: 'proj-1',
          title: 'Transformação & Acabamento Residencial',
          description: 'Execução de reparo completo, preparação de superfície e acabamento com garantia técnica.',
          beforeImage: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&auto=format&fit=crop&q=80',
          afterImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
          category: 'Reforma & Manutenção'
        }
      ];

  return (
    <div className="flex-1 bg-gray-50 pb-12">
      {/* Cover and Profile Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="h-32 md:h-48 bg-gradient-to-r from-brand-600 to-brand-400"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative flex flex-col md:flex-row md:items-end -mt-12 md:-mt-16 pb-8">
                <div className="relative inline-block self-start md:self-auto">
                  <img 
                      src={profile.avatar || "https://via.placeholder.com/150"} 
                      alt={profile.name}
                      loading="lazy"
                      decoding="async"
                      className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                  />
                  {profile.isCertified && (
                    <span className="absolute bottom-1 right-1 bg-white p-0.5 rounded-full shadow-md">
                      <VerifiedBadge size={22} />
                    </span>
                  )}
                </div>
                
                <div className="mt-4 md:mt-0 md:ml-6 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-1.5">
                          <span>{profile.name}</span>
                          {profile.isCertified && <VerifiedBadge size="md" />}
                        </h1>
                        {profile.isCertified && (
                            <VerifiedBadge showText text="Verificado Oficial" />
                        )}
                    </div>
                    <div className="flex flex-wrap items-center mt-2 text-sm text-gray-600 gap-4">
                        {/* Status de Atendimento em Tempo Real (Directorist Style) */}
                        {(() => {
                            const primaryAvailability = ads[0]?.availability;
                            const bStatus = getBusinessStatus(primaryAvailability);
                            return (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${bStatus.colorClass}`}>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${bStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                    {bStatus.statusText}
                                </span>
                            );
                        })()}

                        {profile.location && (
                            <span className="flex items-center">
                                <MapPin size={16} className="mr-1 text-gray-400" /> {profile.location}
                            </span>
                        )}
                        <span className="flex items-center text-yellow-600 font-medium">
                            <Star size={16} className="mr-1 fill-yellow-500 text-yellow-500" /> 
                            {averageRating} <span className="text-gray-400 ml-1">({totalReviews} avaliações)</span>
                        </span>
                    </div>
                </div>

                <div className="mt-6 md:mt-0 md:ml-6 flex items-center flex-wrap gap-2.5">
                    <button
                        onClick={handleShareProfile}
                        className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2 px-3.5 rounded-lg shadow-2xs transition-colors flex items-center text-sm"
                        title="Compartilhar link do perfil"
                    >
                        {copiedLink ? <Check size={16} className="mr-1.5 text-emerald-600" /> : <Share2 size={16} className="mr-1.5 text-gray-500" />}
                        {copiedLink ? 'Link Copiado!' : 'Compartilhar'}
                    </button>

                    <button
                        onClick={() => setShowBusinessCard(true)}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold py-2 px-4 rounded-lg shadow-2xs transition-colors flex items-center text-sm"
                        title="Ver e compartilhar cartão de visitas digital"
                    >
                        <QrCode size={16} className="mr-2 text-purple-600" /> Cartão Digital
                    </button>

                    {user?.id !== profile.id && ads.length > 0 && (
                        <button 
                            onClick={() => handleStartChat(ads[0].id)}
                            className="bg-brand-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm hover:bg-brand-700 transition-colors flex items-center"
                        >
                            <MessageSquare size={18} className="mr-2" /> Falar com {profile.name.split(' ')[0]}
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Info */}
        <aside className="md:w-1/3 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24 space-y-4">
                <h3 className="font-bold text-gray-900 text-lg mb-2">Sobre o profissional</h3>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm">
                    {profile.bio || "Este profissional ainda não adicionou uma biografia."}
                </p>
                {profile.isCertified && (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
                    <VerifiedBadge size="md" className="shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-blue-950">Profissional Verificado Mestrio</h4>
                      <p className="text-[11px] text-blue-700">Documentação e identidade validadas oficialmente pela plataforma.</p>
                    </div>
                  </div>
                )}

                {/* Redes Sociais & Links Oficiais */}
                {(profile.instagram || profile.facebook || profile.linkedin || profile.youtube || profile.tiktok || profile.website) && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Globe size={13} className="text-brand-600" /> Redes Sociais & Links
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {profile.instagram && (
                        <a
                          href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                        >
                          📸 Instagram
                        </a>
                      )}
                      {profile.facebook && (
                        <a
                          href={profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                        >
                          🌐 Facebook
                        </a>
                      )}
                      {profile.linkedin && (
                        <a
                          href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                        >
                          💼 LinkedIn
                        </a>
                      )}
                      {profile.youtube && (
                        <a
                          href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                        >
                          ▶️ YouTube
                        </a>
                      )}
                      {profile.tiktok && (
                        <a
                          href={profile.tiktok.startsWith('http') ? profile.tiktok : `https://tiktok.com/@${profile.tiktok.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                        >
                          🎵 TikTok
                        </a>
                      )}
                      {profile.website && (
                        <a
                          href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                        >
                          🔗 Site / Portfólio
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Compartilhamento Rápido */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Divulgue este perfil:</p>
                  <button
                    onClick={handleShareProfile}
                    className="w-full py-2.5 px-3 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl text-xs font-bold text-brand-700 flex items-center justify-center gap-2 transition shadow-xs"
                  >
                    <Share2 size={15} /> Compartilhar nas Redes Sociais
                  </button>
                </div>
            </div>
        </aside>

        {/* Ads & Portfolio Showcase */}
        <main className="md:w-2/3 space-y-8">
            {/* Galeria de Resultados Antes & Depois */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-500" /> Resultados & Transformações (Antes/Depois)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Arraste o slider para comparar o estado inicial e o resultado final do serviço.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {beforeAfterProjects.map(proj => (
                  <BeforeAfterSlider key={proj.id} project={proj} />
                ))}
              </div>
            </div>

            {/* Avaliação Multi-Critérios Consolidada */}
            {allReviews.length > 0 && (
              <div>
                <MultiCriteriaBreakdown reviews={allReviews} overallRating={Number(averageRating)} />
              </div>
            )}

            {/* Lista de Anúncios */}
            <div>
              <h3 className="font-bold text-gray-900 text-xl mb-6">Serviços Publicados ({ads.length})</h3>
              
              {ads.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                      Nenhum anúncio publicado no momento.
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {ads.map(ad => (
                          <ServiceCard key={ad.id} ad={ad} compact />
                      ))}
                  </div>
              )}
            </div>
        </main>
      </div>

      {/* Modal de Cartão de Visitas Digital */}
      {profile && (
        <DigitalBusinessCardModal
          isOpen={showBusinessCard}
          onClose={() => setShowBusinessCard(false)}
          user={profile}
        />
      )}

      {/* Modal de Compartilhamento Social */}
      {profile && (
        <SocialShareModal
          isOpen={showSocialShare}
          onClose={() => setShowSocialShare(false)}
          title={`Perfil de ${profile.name} no Mestrio`}
          description={profile.bio || 'Confira os serviços, avaliações e portfólio deste profissional!'}
        />
      )}
    </div>
  );
};

export default PublicProfile;
