
// Add React import to resolve namespace errors for FC and FormEvent
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, Star, Shield, Clock, Calendar, MessageSquare, CalendarCheck, X, Send, AlertTriangle, Loader2, CheckCircle, Navigation, LocateFixed, ChevronLeft, ChevronRight, ZoomIn, Heart, Eye } from 'lucide-react';
import { store } from '../services/store';
import { ServiceAd, Review } from '../types';
import { RatingStars, Badge } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { getBusinessStatus } from '../utils/businessHours';
import { MultiCriteriaBreakdown, MultiCriteriaRatingInput, ReviewCriteriaBadges } from '../components/MultiCriteriaReviewWidget';
import { ReviewCriteria } from '../types';

const ServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [ad, setAd] = useState<ServiceAd | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Reviews State com Multi-Critérios (Directorist Pattern)
  const [newReview, setNewReview] = useState({
    comment: '',
    criteria: {
      punctuality: 5,
      quality: 5,
      fairPrice: 5,
      communication: 5,
    } as ReviewCriteria,
  });
  const [reviewError, setReviewError] = useState('');

  // Scheduling State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', notes: '', location: '' });
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const handleReportAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!ad) return;
    if (!reportReason.trim()) { toast('Informe o motivo da denúncia.', 'error'); return; }

    setIsSubmittingReport(true);
    try {
      await store.createReport({
        reporterId: user.id,
        targetType: 'ad',
        targetId: ad.id,
        reason: reportReason.trim(),
        details: reportDetails.trim(),
      });
      toast('Denúncia enviada com sucesso. Nossa equipe analisará em breve.', 'success');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch (e) {
      toast('Erro ao enviar denúncia.', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

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

  const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const getWeekdayLabel = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    return WEEKDAY_LABELS[d.getDay()];
  };

  const DAY_NAMES: Record<string, string> = {
    seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo'
  };

  const formatAvailability = (): string => {
    if (!ad?.availability) return 'Consultar disponibilidade';
    const av = parseAvailability(ad.availability);
    if (!av) return 'Consultar disponibilidade';
    const daysText = av.days.length > 0
      ? av.days.map(d => DAY_NAMES[d] || d).join(', ')
      : 'Dias a combinar';
    const timeText = `${av.start.replace(':00', 'h')} às ${av.end.replace(':00', 'h')}`;
    return `${daysText} • ${timeText}`;
  };

  const timeToMinutes = (time: string): number => {
    const [h = 0, m = 0] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const availability = parseAvailability(ad?.availability);

  const { user } = useAuth();
  const navigate = useNavigate();

  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    const loadAd = async () => {
      if (id) {
          const found = await store.getAdById(id);
          setAd(found || undefined);
          if (user && found) {
            const fav = await store.isFavorite(user.id, found.id);
            setIsFav(fav);
          }
      }
      setLoading(false);
    };
    loadAd();
  }, [id, user]);

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!ad) return;
    const added = await store.toggleFavorite(user.id, ad.id);
    setIsFav(added);
    toast(added ? 'Anúncio adicionado aos seus favoritos! ❤️' : 'Anúncio removido dos favoritos.', added ? 'success' : 'info');
  };

  // Conta a visualização uma única vez por montagem da página
  const viewCountedRef = React.useRef(false);
  useEffect(() => {
    if (!id || viewCountedRef.current) return;
    viewCountedRef.current = true;
    store.incrementAdView(id);
  }, [id]);

  // Lightbox: navegação por teclado (Esc, setas) e trava o scroll
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex(prev => (prev === null || !ad) ? prev : (prev + 1) % ad.images.length);
      if (e.key === 'ArrowLeft') setLightboxIndex(prev => (prev === null || !ad) ? prev : (prev - 1 + ad.images.length) % ad.images.length);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, ad]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
      <p className="text-gray-500">Carregando detalhes do serviço...</p>
    </div>
  );
  
  if (!ad) return (
    <div className="p-10 text-center flex flex-col items-center">
      <AlertTriangle className="text-yellow-500 mb-4" size={48} />
      <h2 className="text-2xl font-bold mb-2">Serviço não encontrado</h2>
      <Link to="/" className="text-brand-600 font-semibold hover:underline">Voltar para a página inicial</Link>
    </div>
  );

  const handleContact = () => {
      if (!user) {
          navigate('/login');
          return;
      }
      // Sanitiza o WhatsApp do anúncio: apenas dígitos (o campo é controlado
      // pelo provider e pode conter caracteres maliciosos).
      const digits = String(ad.whatsapp || '').replace(/\D/g, '');
      if (!digits) {
          toast("Este profissional não configurou um número de WhatsApp válido.", 'error');
          return;
      }
      const message = `Olá, vi seu anúncio "${ad.title}" no Mestrio e gostaria de mais informações.`;
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleInternalChat = async () => {
      if (!user) {
          navigate('/login');
          return;
      }
      if (user.id === ad.providerId) {
          toast("Você não pode iniciar um chat com seu próprio anúncio.", 'error');
          return;
      }

      try {
        const chatId = await store.startChat(user.id, ad.providerId, ad.id, ad.title);
        navigate(`/dashboard/chat/${chatId}`);
      } catch (e: any) {
        console.error(e);
        toast("Erro ao iniciar chat. Verifique as permissões de banco de dados (RLS).", 'error');
      }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) {
          navigate('/login');
          return;
      }
      if (user.id === ad.providerId) {
          setReviewError("Você não pode avaliar seu próprio serviço.");
          return;
      }

      setSubmittingReview(true);
      setReviewError('');

      try {
        const overallRating = Number((
          (newReview.criteria.punctuality + newReview.criteria.quality + newReview.criteria.fairPrice + newReview.criteria.communication) / 4
        ).toFixed(1));

        const reviewData: Omit<Review, 'id' | 'date'> = {
            authorId: user.id,
            authorName: user.name,
            rating: overallRating,
            comment: newReview.comment,
            criteria: newReview.criteria,
        };

        await store.addReview(ad.id, reviewData);
        
        // Refresh ad data to show new review
        const updatedAd = await store.getAdById(ad.id);
        if (updatedAd) setAd(updatedAd);
        
        setNewReview({
          comment: '',
          criteria: {
            punctuality: 5,
            quality: 5,
            fairPrice: 5,
            communication: 5,
          }
        });
        toast("Avaliação multi-critérios publicada com sucesso!", 'success');
      } catch (err: any) {
        console.error("Erro ao enviar avaliação:", err);
        if (err.code === '42501') {
            setReviewError("Erro de permissão no Supabase (RLS): A tabela 'reviews' não permite inserção via chave pública. Verifique o console ou as instruções no store.ts.");
        } else {
            setReviewError("Houve um erro ao publicar sua avaliação. Tente novamente.");
        }
      } finally {
        setSubmittingReview(false);
      }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
        toast("Seu navegador não suporta geolocalização.", 'error');
        return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=pt`);
            const data = await res.json();
            const informative = data.localityInfo?.informative || [];
            const road = informative.find((i: any) => ['road', 'street'].includes(i.description))?.name;
            const neighborhood = informative.find((i: any) => ['neighbourhood', 'neighborhood', 'suburb'].includes(i.description))?.name;
            const city = data.city || data.locality || informative.find((i: any) => i.description === 'city')?.name;
            const state = data.principalSubdivisionCode?.split('-')[1] || data.principalSubdivision;
            const parts: string[] = [];
            if (road) parts.push(road);
            if (neighborhood) parts.push(neighborhood);
            if (city) parts.push(city);
            if (state) parts.push(state);
            const loc = parts.join(', ');
            setScheduleData(prev => ({ ...prev, location: loc }));
        } catch (e) {
            console.error(e);
            toast('Erro ao buscar localização.', 'error');
        } finally {
            setIsLocating(false);
        }
    }, () => {
        toast('Permissão de localização negada.', 'error');
        setIsLocating(false);
    });
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) {
          navigate('/login');
          return;
      }

      if (availability && scheduleData.date) {
          const weekday = getWeekdayLabel(scheduleData.date);
          if (availability.days.length > 0 && !availability.days.includes(weekday)) {
              const daysFormatted = availability.days
                  .map(d => d.charAt(0).toUpperCase() + d.slice(1))
                  .join(', ');
              setScheduleError(`Este profissional não atende nesse dia. Dias disponíveis: ${daysFormatted}.`);
              return;
          }
      }

      if (availability && scheduleData.time) {
          if (scheduleData.time < availability.start || scheduleData.time > availability.end) {
              setScheduleError(`O horário escolhido está fora do horário de atendimento (${availability.start} às ${availability.end}).`);
              return;
          }
      }

      setIsScheduling(true);
      setScheduleError('');
      try {
        const formattedDate = new Date(scheduleData.date).toLocaleDateString('pt-BR');
        const message = `📅 *SOLICITAÇÃO DE AGENDAMENTO*\n\nOlá, gostaria de agendar um serviço:\n\n🗓️ Data: ${formattedDate}\n⏰ Horário: ${scheduleData.time}\n📍 Local: ${scheduleData.location || 'A combinar'}\n📝 Observações: ${scheduleData.notes || 'Nenhuma'}\n\nPodemos confirmar?`;

        const chatId = await store.startChat(user.id, ad.providerId, ad.id, ad.title);
        await store.sendMessage(chatId, user.id, message);
        
        await store.createAppointment({
          clientId: user.id,
          providerId: ad.providerId,
          adId: ad.id,
          date: scheduleData.date,
          time: scheduleData.time,
          notes: scheduleData.notes,
          clientLocation: scheduleData.location || user.location
        });

        setShowScheduleModal(false);
        navigate(`/dashboard/chat/${chatId}`);
      } catch (e: any) {
        console.error(e);
        toast("Não foi possível solicitar o agendamento. Tente novamente mais tarde.", 'error');
      } finally {
        setIsScheduling(false);
      }
  };

  return (
    <div className="flex-1 bg-gray-50 pb-12 relative">
      {/* Header Image */}
      <div className="bg-gray-900 h-64 md:h-80 w-full relative">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          aria-label="Abrir foto em tela cheia"
          className="absolute inset-0 w-full h-full cursor-zoom-in"
        >
          <img src={ad.images[0]} className="w-full h-full object-cover opacity-60" alt={ad.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
        </button>
        <div className="absolute inset-x-0 bottom-0 left-0 w-full p-4 md:p-8 pointer-events-none">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">{ad.category}</Badge>
                      {ad.isPremium && <Badge variant="secondary">Destaque</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleFavorite}
                        className={`pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow ${
                          isFav
                            ? 'bg-rose-600 text-white shadow-rose-600/30'
                            : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border border-white/20'
                        }`}
                      >
                        <Heart size={15} className={isFav ? 'fill-white' : ''} />
                        {isFav ? 'Salvo nos Favoritos' : 'Favoritar Anúncio'}
                      </button>

                      <button
                        onClick={() => setShowReportModal(true)}
                        className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow bg-white/20 text-white hover:bg-rose-600/80 backdrop-blur-md border border-white/20"
                        title="Denunciar este anúncio"
                      >
                        <AlertTriangle size={15} /> Denunciar
                      </button>
                    </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{ad.title}</h1>
                <div className="flex items-center text-gray-300 text-sm mb-4 flex-wrap gap-2">
                    <span className="flex items-center"><MapPin size={16} className="mr-1" /> {ad.location}</span>
                    <span>•</span>
                    <RatingStars rating={ad.rating} />
                    <span>({ad.reviewCount} avaliações)</span>
                    <span>•</span>
                    <span className="flex items-center text-gray-200 font-mono text-xs bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm">
                      <Eye size={13} className="mr-1 text-slate-300" /> {ad.views || 0} visualizações
                    </span>
                </div>
                
                {ad.tags && ad.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {ad.tags.map(tag => (
                            <span key={tag} className="text-xs font-semibold bg-white/10 text-white px-3 py-1 rounded-full backdrop-blur-sm border border-white/20">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Sobre o Serviço</h2>
                    <div className="prose text-gray-600 whitespace-pre-line leading-relaxed">
                        {ad.description}
                    </div>
                </div>

                {ad.images.length > 1 && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Galeria de Fotos</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {ad.images.map((img, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setLightboxIndex(idx)}
                                    aria-label={`Abrir foto ${idx + 1} em tela cheia`}
                                    className="relative group rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in"
                                >
                                    <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-40 object-cover group-hover:scale-105 transition-transform" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Avaliações & Reputação</h2>
                    
                    {/* Painel Consolidado de Multi-Critérios (Directorist Pattern) */}
                    <MultiCriteriaBreakdown reviews={ad.reviews} overallRating={ad.rating} />

                    {/* Review Form */}
                    {user && user.id !== ad.providerId && (
                        <form onSubmit={handleSubmitReview} className="mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center">
                                <Star size={20} className="mr-2 text-yellow-500 fill-current" /> Deixar uma Avaliação Detalhada
                            </h3>
                            
                            {reviewError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm flex items-start">
                                    <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                                    <span>{reviewError}</span>
                                </div>
                            )}

                            {/* Seletor dos 4 Pilares Interativos */}
                            <MultiCriteriaRatingInput
                              criteria={newReview.criteria}
                              onChange={(c) => setNewReview(prev => ({ ...prev, criteria: c }))}
                            />

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Seu Comentário sobre o Serviço</label>
                                <textarea 
                                    placeholder="Conte detalhes sobre o trabalho realizado, pontualidade, atendimento e se você recomenda o profissional..." 
                                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-white"
                                    rows={3}
                                    value={newReview.comment}
                                    onChange={(e) => setNewReview(prev => ({...prev, comment: e.target.value}))}
                                    required
                                />
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={submittingReview}
                                className="w-full sm:w-auto bg-brand-600 text-white px-6 py-2.5 rounded-xl hover:bg-brand-700 font-bold flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {submittingReview ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={18} /> Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} className="mr-2" /> Publicar Avaliação
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {!user && (
                        <div className="mb-8 p-4 bg-brand-50 rounded-xl border border-brand-100 text-center">
                            <p className="text-brand-800 text-sm">
                                <Link to="/login" className="font-bold underline">Faça login</Link> para deixar uma avaliação para este profissional.
                            </p>
                        </div>
                    )}

                    {ad.reviews.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400 italic">Este profissional ainda não recebeu nenhuma avaliação escrita.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {ad.reviews.map(review => (
                                <div key={review.id} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0 group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm mr-3 shadow-sm">
                                                {review.authorName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{review.authorName}</p>
                                                <p className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <RatingStars rating={review.rating} size={14} />
                                    </div>
                                    <p className="text-gray-600 text-sm mt-2 leading-relaxed">{review.comment}</p>
                                    
                                    {/* Mini Badges dos Critérios Individuais */}
                                    <ReviewCriteriaBadges criteria={review.criteria} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar / CTA */}
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-24 border-t-4 border-brand-500">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-gray-500 text-sm font-medium">Investimento</span>
                        <div className="text-right">
                             <span className="text-3xl font-extrabold text-gray-900">
                                {ad.price === 0 ? 'A combinar' : `R$ ${ad.price}`}
                            </span>
                            {ad.price > 0 && <div className="text-xs text-gray-400">por {ad.priceUnit === 'hour' ? 'hora' : 'serviço'}</div>}
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        {user?.id === ad.providerId ? (
                            <>
                                <button 
                                    onClick={() => navigate(`/edit-ad/${ad.id}`)}
                                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center transition-all"
                                >
                                    Editar Meu Anúncio
                                </button>
                                <button 
                                    onClick={() => navigate('/dashboard/chat')}
                                    className="w-full bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold py-3.5 px-4 rounded-xl border border-brand-200 flex items-center justify-center transition-all"
                                >
                                    Ver Minhas Mensagens
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => {
                                        if (!user) { navigate('/login'); return; }
                                        setShowScheduleModal(true);
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center transition-all transform active:scale-95"
                                >
                                    <CalendarCheck className="mr-2" size={20} /> Solicitar Agendamento
                                </button>

                                <button 
                                    onClick={handleInternalChat}
                                    className="w-full bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold py-3.5 px-4 rounded-xl border border-brand-200 flex items-center justify-center transition-all"
                                >
                                    <MessageSquare className="mr-2" size={20} /> Chat no App
                                </button>
                                
                                <button 
                                    onClick={handleContact}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center transition-all"
                                >
                                    <MessageCircle className="mr-2" size={20} /> WhatsApp Direto
                                </button>
                            </>
                        )}
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex items-center mb-5">
                            <div className="relative w-14 h-14 bg-gray-100 rounded-full flex-shrink-0 mr-4 overflow-visible border-2 border-brand-100">
                                <div className="w-full h-full rounded-full overflow-hidden">
                                  {ad.providerAvatar ? (
                                      <img src={ad.providerAvatar} className="w-full h-full object-cover" alt={ad.providerName} />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-brand-600 font-bold text-xl">{ad.providerName.charAt(0)}</div>
                                  )}
                                </div>
                                {ad.isCertified && (
                                  <span className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-sm">
                                    <VerifiedBadge size={16} />
                                  </span>
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-lg leading-tight flex items-center gap-1.5">
                                  <span>{ad.providerName}</span>
                                  {ad.isCertified && <VerifiedBadge size="sm" />}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center mt-1">
                                    {ad.isCertified ? (
                                        <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                                          <VerifiedBadge size={13} /> Profissional Verificado Mestrio
                                        </span>
                                    ) : (
                                        'Profissional Mestrio'
                                    )}
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-xl">
                             {/* Status de Atendimento em Tempo Real (Directorist Style) */}
                             {(() => {
                               const bStatus = getBusinessStatus(ad.availability);
                               return (
                                 <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-200/70">
                                   <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bStatus.isOpen ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-gray-400 ring-2 ring-gray-200'}`}></span>
                                   <span className={`text-xs font-bold ${bStatus.isOpen ? 'text-emerald-700' : 'text-gray-600'}`}>
                                     {bStatus.statusText}
                                   </span>
                                 </div>
                               );
                             })()}

                             {ad.isCertified && (
                               <div className="flex items-center text-blue-900 font-medium">
                                 <VerifiedBadge size={16} className="mr-3" /> Identidade & Documentos Verificados
                                </div>
                             )}
                             <div className="flex items-center"><Clock size={16} className="mr-3 text-indigo-500"/> Responde em poucos minutos</div>
                             <div className="flex items-start"><Calendar size={16} className="mr-3 text-orange-500 mt-0.5"/> <span>{formatAvailability()}</span></div>
                        </div>

                        <Link
                          to={`/profissional/${ad.providerId}`}
                          className="mt-3.5 w-full bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs py-2.5 px-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-center transition"
                        >
                          Ver Perfil Completo & Portfólio →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Appointment Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-indigo-600 p-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center tracking-tight">
                        <CalendarCheck size={20} className="mr-2" /> Agendar Serviço
                    </h3>
                    <button onClick={() => setShowScheduleModal(false)} className="text-white/80 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleScheduleSubmit} className="p-4 space-y-3">
                    <p className="text-xs text-gray-600 mb-2 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
                        Seu pedido será enviado via chat para <strong>{ad.providerName}</strong>.
                    </p>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Qual o melhor dia?</label>
                        <input 
                            type="date" 
                            required
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={scheduleData.date}
                            onChange={(e) => {
                                setScheduleData(prev => ({...prev, date: e.target.value}));
                                setScheduleError('');
                            }}
                            min={todayLocal}
                        />
                        {availability && availability.days.length > 0 && (
                            <p className="text-[11px] text-gray-500 mt-1">
                                Dias de atendimento: <strong>{availability.days.map(d => DAY_NAMES[d] || d).join(', ')}</strong>
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Qual o horário?</label>
                        <input 
                            type="time" 
                            required
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={scheduleData.time}
                            min={availability?.start}
                            max={availability?.end}
                            onChange={(e) => {
                                setScheduleData(prev => ({...prev, time: e.target.value}));
                                setScheduleError('');
                            }}
                        />
                        {availability && (
                            <p className="text-[11px] text-gray-500 mt-1">
                                Horário de atendimento: <strong>{availability.start} às {availability.end}</strong>
                            </p>
                        )}
                    </div>

                    {scheduleError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg">
                            {scheduleError}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center"><MapPin size={13} className="mr-1.5 text-indigo-500" /> Onde deseja ser atendido?</span>
                            <button 
                                type="button"
                                onClick={handleGetLocation}
                                disabled={isLocating}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center disabled:opacity-50"
                            >
                                {isLocating ? <Loader2 size={11} className="animate-spin mr-1" /> : <LocateFixed size={11} className="mr-1" />}
                                Usar GPS
                            </button>
                        </label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Ex: Pinheiros, São Paulo - SP"
                            value={scheduleData.location}
                            onChange={(e) => setScheduleData(prev => ({...prev, location: e.target.value}))}
                        />
                        <p className="text-[11px] text-gray-500 mt-1">
                            {scheduleData.location ? 'A localização será enviada ao profissional.' : (user?.location ? `Localização do seu perfil: ${user.location}` : 'Usado o endereço informado no agendamento.')}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Alguma observação?</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            rows={2}
                            placeholder="Descreva brevemente o que precisa ser feito..."
                            value={scheduleData.notes}
                            onChange={(e) => setScheduleData(prev => ({...prev, notes: e.target.value}))}
                        />
                    </div>

                    <div className="pt-3 flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setShowScheduleModal(false)}
                            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-bold text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isScheduling}
                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-sm shadow-lg transition-all flex items-center justify-center disabled:opacity-50"
                        >
                            {isScheduling ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                            {isScheduling ? 'Enviando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Lightbox (visualizador de fotos em tela cheia) */}
      {lightboxIndex !== null && ad && ad.images.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de fotos"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Fechar visualizador"
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 transition-colors z-10"
          >
            <X size={28} />
          </button>

          {ad.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev === null ? prev : (prev - 1 + ad.images.length) % ad.images.length); }}
                aria-label="Foto anterior"
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 rounded-full p-2 md:p-3 transition-colors"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev === null ? prev : (prev + 1) % ad.images.length); }}
                aria-label="Próxima foto"
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 rounded-full p-2 md:p-3 transition-colors"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          <img
            src={ad.images[lightboxIndex]}
            alt={`${ad.title} — Foto ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[92vw] md:max-w-[85vw] object-contain rounded-lg shadow-2xl"
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/90 text-sm font-medium bg-black/50 rounded-full px-4 py-1.5">
            {lightboxIndex + 1} / {ad.images.length}
          </div>
        </div>
      )}

      {/* Modal de Denúncia de Anúncio */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-rose-500" size={20} /> Denunciar Anúncio
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleReportAd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Motivo da Denúncia</label>
                <select
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none"
                  required
                >
                  <option value="">Selecione o motivo...</option>
                  <option value="Conteúdo Adulto, Sexual ou Acompanhante">Conteúdo Adulto, Sexual ou Acompanhante</option>
                  <option value="Serviço Falso ou Golpe / Fraude">Serviço Falso ou Golpe / Fraude</option>
                  <option value="Preço Irreal / Isca Enganosa">Preço Irreal / Isca Enganosa</option>
                  <option value="Conteúdo Inadequado ou Ofensivo">Conteúdo Inadequado ou Ofensivo</option>
                  <option value="Telefone / Contato Inválido ou Mascarado">Telefone / Contato Inválido ou Mascarado</option>
                  <option value="Outro">Outro Motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Detalhes Adicionais (opcional)</label>
                <textarea
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Descreva o problema para ajudar nossa equipe na moderação..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none h-24"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmittingReport ? 'Enviando...' : 'Enviar Denúncia'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceDetail;
