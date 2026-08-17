import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { store } from '../services/store';
import { User, ServiceAd } from '../types';
import { ServiceCard } from '../components/UI';
import { MessageSquare, MapPin, Star, CheckCircle2, User as UserIcon, QrCode, Award, Share2, Copy, Check, MessageCircle, Globe, ExternalLink, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DigitalBusinessCardModal } from '../components/DigitalBusinessCardModal';
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
          // Atualiza tags de Open Graph e título no head para navegadores e compartilhamento
          document.title = `${p.name} | Profissional Mestrio`;
          const setMetaTag = (attr: string, key: string, content: string) => {
            let el = document.querySelector(`meta[${attr}="${key}"]`);
            if (!el) {
              el = document.createElement('meta');
              el.setAttribute(attr, key);
              document.head.appendChild(el);
            }
            el.setAttribute('content', content);
          };

          if (p.avatar) {
            setMetaTag('property', 'og:image', p.avatar);
            setMetaTag('name', 'twitter:image', p.avatar);
          }
          setMetaTag('property', 'og:title', `${p.name} - Profissional no Mestrio`);
          setMetaTag('property', 'og:description', p.bio || 'Confira os serviços, avaliações e portfólio deste profissional no Mestrio.');

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

  const ALL_WEEK_DAYS = [
    { key: 'seg', name: 'Segunda-feira', short: 'Seg', dayIndex: 1 },
    { key: 'ter', name: 'Terça-feira', short: 'Ter', dayIndex: 2 },
    { key: 'qua', name: 'Quarta-feira', short: 'Qua', dayIndex: 3 },
    { key: 'qui', name: 'Quinta-feira', short: 'Qui', dayIndex: 4 },
    { key: 'sex', name: 'Sexta-feira', short: 'Sex', dayIndex: 5 },
    { key: 'sab', name: 'Sábado', short: 'Sáb', dayIndex: 6 },
    { key: 'dom', name: 'Domingo', short: 'Dom', dayIndex: 0 },
  ];

  const parseAvailability = (availability?: string): { days: string[]; start: string; end: string } | null => {
    if (!availability) return null;
    const timeMatch = availability.match(/(\d{1,2}:\d{2})\s*[-àa]\s*(\d{1,2}:\d{2})/i);
    if (!timeMatch) return null;
    const start = timeMatch[1].padStart(5, '0');
    const end = timeMatch[2].padStart(5, '0');
    const dayPart = availability.replace(timeMatch[0], '');
    const dayAliases: Record<string, string> = {
      'seg': 'seg', 'segunda': 'seg', 'segunda-feira': 'seg',
      'ter': 'ter', 'terça': 'ter', 'terca': 'ter', 'terça-feira': 'ter', 'terca-feira': 'ter',
      'qua': 'qua', 'quarta': 'qua', 'quarta-feira': 'qua',
      'qui': 'qui', 'quinta': 'qui', 'quinta-feira': 'qui',
      'sex': 'sex', 'sexta': 'sex', 'sexta-feira': 'sex',
      'sab': 'sab', 'sáb': 'sab', 'sábado': 'sab', 'sabado': 'sab',
      'dom': 'dom', 'domingo': 'dom',
    };
    const rawDays = dayPart.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const days: string[] = [];
    for (const raw of rawDays) {
      const normalized = raw.replace(/[áàâã]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íìî]/g, 'i').replace(/[óòôõ]/g, 'o').replace(/[úùû]/g, 'u').replace(/ç/g, 'c');
      if (dayAliases[normalized]) {
        const key = dayAliases[normalized];
        if (!days.includes(key)) days.push(key);
      }
    }
    if (days.length === 0) return { days: [], start, end };
    return { days, start, end };
  };

  const getWeeklySchedule = () => {
    const rawAvailability = ads[0]?.availability || (profile as any)?.availability;
    const todayIndex = new Date().getDay();

    if (!rawAvailability) {
      return ALL_WEEK_DAYS.map(day => ({
        ...day,
        isToday: day.dayIndex === todayIndex,
        isOpen: day.dayIndex >= 1 && day.dayIndex <= 5,
        timeRange: day.dayIndex >= 1 && day.dayIndex <= 5 ? '08:00 às 18:00' : 'Fechado'
      }));
    }

    const is24h = /24\s*h|24\s*horas/i.test(rawAvailability);
    if (is24h) {
      return ALL_WEEK_DAYS.map(day => ({
        ...day,
        isToday: day.dayIndex === todayIndex,
        isOpen: true,
        timeRange: '24 Horas (Atendimento Contínuo)'
      }));
    }

    const av = parseAvailability(rawAvailability);
    if (!av) {
      return ALL_WEEK_DAYS.map(day => ({
        ...day,
        isToday: day.dayIndex === todayIndex,
        isOpen: day.dayIndex >= 1 && day.dayIndex <= 5,
        timeRange: day.dayIndex >= 1 && day.dayIndex <= 5 ? '08:00 às 18:00' : 'Fechado'
      }));
    }

    const timeFormatted = `${av.start} às ${av.end}`;
    return ALL_WEEK_DAYS.map(day => {
      const isOpen = av.days.includes(day.key);
      return {
        ...day,
        isToday: day.dayIndex === todayIndex,
        isOpen,
        timeRange: isOpen ? timeFormatted : 'Fechado'
      };
    });
  };

  return (
    <div className="flex-1 bg-gray-50 pb-16">
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
                        {(() => {
                            const bStatus = getBusinessStatus(ads[0]?.availability);
                            return (
                                <span className={`flex items-center font-semibold text-xs px-2.5 py-1 rounded-full ${
                                    bStatus.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full mr-1.5 ${bStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
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
                    >
                        {copiedLink ? <Check size={16} className="mr-1.5 text-emerald-600" /> : <Share2 size={16} className="mr-1.5 text-gray-500" />}
                        {copiedLink ? 'Link Copiado!' : 'Compartilhar'}
                    </button>

                    <button
                        onClick={() => setShowBusinessCard(true)}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold py-2 px-4 rounded-lg shadow-2xs transition-colors flex items-center text-sm"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2 mb-3">
                  Sobre o profissional
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base font-normal">
                  {profile.bio || "Este profissional ainda não adicionou uma biografia."}
                </p>
              </div>

              {profile.isCertified && (
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-center gap-3.5">
                  <VerifiedBadge size="md" className="shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-950">Profissional Verificado Oficial Mestrio</h4>
                    <p className="text-xs text-blue-700">Documentação e identidade validadas oficialmente pela equipe de segurança da plataforma.</p>
                  </div>
                </div>
              )}

              {(profile.instagram || profile.facebook || profile.linkedin || profile.youtube || profile.tiktok || profile.website) && (
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Globe size={14} className="text-brand-600" /> Redes Sociais & Links Oficiais
                  </h4>
                  <div className="flex flex-wrap gap-2.5">
                    {profile.instagram && (
                      <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">📸 Instagram</a>
                    )}
                    {profile.facebook && (
                      <a href={profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">🌐 Facebook</a>
                    )}
                    {profile.linkedin && (
                      <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">💼 LinkedIn</a>
                    )}
                    {profile.youtube && (
                      <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">▶️ YouTube</a>
                    )}
                    {profile.tiktok && (
                      <a href={profile.tiktok.startsWith('http') ? profile.tiktok : `https://tiktok.com/@${profile.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">🎵 TikTok</a>
                    )}
                    {profile.website && (
                      <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">🔗 Site / Portfólio</a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-slate-50 p-5 rounded-xl border border-slate-200/80 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar size={16} className="text-orange-500" /> Horários de Atendimento
                  </h4>
                  {(() => {
                    const bStatus = getBusinessStatus(ads[0]?.availability);
                    return (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        bStatus.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {bStatus.isOpen ? '● Aberto agora' : '● Fechado'}
                      </span>
                    );
                  })()}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden text-xs shadow-2xs">
                  {getWeeklySchedule().map(({ key, name, isToday, isOpen, timeRange }) => (
                    <div 
                      key={key}
                      className={`flex items-center justify-between px-3.5 py-2 transition-colors ${
                        isToday ? 'bg-orange-50/80 font-bold text-orange-950 border-l-3 border-orange-500' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{name}</span>
                        {isToday && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-orange-500 text-white rounded font-bold">Hoje</span>
                        )}
                      </div>
                      <span className={isOpen ? 'text-slate-900 font-semibold' : 'text-slate-400 font-normal'}>
                        {timeRange}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleShareProfile}
                  className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Share2 size={16} /> Compartilhar este Perfil nas Redes Sociais
                </button>
              </div>
            </div>
          </div>
        </div>

        {allReviews.length > 0 && (
          <div>
            <MultiCriteriaBreakdown reviews={allReviews} overallRating={Number(averageRating)} />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 text-2xl">
              Serviços & Anúncios Publicados ({ads.length})
            </h3>
          </div>
          
          {ads.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 space-y-2">
                  <p className="text-base font-medium text-gray-700">Nenhum serviço anunciado no momento.</p>
                  <p className="text-xs text-gray-400">Este profissional ainda não possui anúncios ativos cadastrados.</p>
              </div>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ads.map(ad => (
                      <ServiceCard key={ad.id} ad={ad} />
                  ))}
              </div>
          )}
        </div>
      </div>

      {/* Barra Fixa de Contato no Celular (Mobile Sticky Bar) */}
      {user?.id !== profile.id && ads.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 px-4 flex items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img 
              src={profile.avatar || "https://via.placeholder.com/150"} 
              alt={profile.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{profile.name}</p>
              <p className="text-[11px] text-emerald-600 font-semibold truncate">● Ativo no Mestrio</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {profile.phone && (
              <a
                href={`https://wa.me/55${profile.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${profile.name}! Encontrei seu perfil no Mestrio e gostaria de solicitar um orçamento.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 text-xs transition active:scale-95"
              >
                <MessageCircle size={17} />
                <span>WhatsApp</span>
              </a>
            )}

            <button
              onClick={() => handleStartChat(ads[0].id)}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 text-xs transition active:scale-95"
            >
              <MessageSquare size={17} />
              <span>Chat</span>
            </button>
          </div>
        </div>
      )}

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
          imageUrl={profile.avatar}
        />
      )}
    </div>
  );
};

export default PublicProfile;
