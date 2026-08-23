
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Wand2, Upload, X, Clock, Calendar, Loader2, MapPin, LocateFixed, Info, AlertTriangle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { store, uploadImage } from '../services/store';
import { generateServiceDescription, suggestCategory } from '../services/geminiService';
import { useCategories } from '../context/CategoriesContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AdStatus } from '../types';
import { validateUploadCount, validateUploadFileContent } from '../utils/security';
import { logSecurityWarning, logSecurityError } from '../services/audit';
import { analyzeAdSafety } from '../services/adSafety';
import { getCategoryAttributes } from '../utils/categoryAttributes';
import { parseAllScheduleBlocks } from '../utils/businessHours';

const DAYS_OF_WEEK = [
  { id: 'seg', label: 'Seg', fullName: 'Segunda-feira' },
  { id: 'ter', label: 'Ter', fullName: 'Terça-feira' },
  { id: 'qua', label: 'Qua', fullName: 'Quarta-feira' },
  { id: 'qui', label: 'Qui', fullName: 'Quinta-feira' },
  { id: 'sex', label: 'Sex', fullName: 'Sexta-feira' },
  { id: 'sab', label: 'Sáb', fullName: 'Sábado' },
  { id: 'dom', label: 'Dom', fullName: 'Domingo' },
];

type AvailabilityType = 'standard' | '24h' | 'emergency';

const CreateAd: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { options } = useCategories();

  const [formData, setFormData] = useState({
    title: '',
    category: 'electrician',
    price: '',
    priceUnit: 'job',
    location: '',
    lat: null as number | null,
    lng: null as number | null,
    whatsapp: '',
    description: '',
    keywords: '' 
  });

  // Atributos customizados por especialidade (Directorist Pattern)
  const [customAttributes, setCustomAttributes] = useState<Record<string, boolean>>({});

  // Availability State Flexível
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>('standard');
  const [selectedDays, setSelectedDays] = useState<string[]>(['seg', 'ter', 'qua', 'qui', 'sex']);
  const [hoursStart, setHoursStart] = useState('08:00');
  const [hoursEnd, setHoursEnd] = useState('18:00');
  const [customDailyHours, setCustomDailyHours] = useState(false);
  const [dailyHours, setDailyHours] = useState<Record<string, { start: string; end: string }>>({
    seg: { start: '08:00', end: '18:00' },
    ter: { start: '08:00', end: '18:00' },
    qua: { start: '08:00', end: '18:00' },
    qui: { start: '08:00', end: '18:00' },
    sex: { start: '08:00', end: '18:00' },
    sab: { start: '08:00', end: '12:00' },
    dom: { start: '08:00', end: '12:00' },
  });

  // Images State
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [loadingAd, setLoadingAd] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Tags State
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Moderation status (edit mode)
  const [adStatus, setAdStatus] = useState<AdStatus | null>(null);
  const [adRejectionReason, setAdRejectionReason] = useState<string | undefined>(undefined);
  const [adExpiresAt, setAdExpiresAt] = useState<string | undefined>(undefined);

  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  // Garante que a categoria selecionada sempre exista nas opções dinâmicas.
  React.useEffect(() => {
    if (options.length <= 1) return;
    setFormData(prev => {
      const valid = options.some(c => c.id === prev.category);
      if (valid) return prev;
      const first = options.find(c => c.id !== 'all');
      return first ? { ...prev, category: first.id } : prev;
    });
  }, [options]);

  // Initial load for editing
  React.useEffect(() => {
    if (isEditing && user) {
        setLoadingAd(true);
        store.getAds({ providerId: user.id }).then(ads => {
            const ad = ads.find(a => a.id === id);
            if (ad && ad.providerId === user.id) {
                setFormData({
                    title: ad.title,
                    category: ad.category,
                    price: ad.price.toString(),
                    priceUnit: ad.priceUnit,
                    location: ad.location,
                    lat: ad.lat || null,
                    lng: ad.lng || null,
                    whatsapp: ad.whatsapp,
                    description: ad.description,
                    keywords: ''
                });
                setImages(ad.images || []);
                setTags(ad.tags || []);
                setCustomAttributes((ad.customAttributes as Record<string, boolean>) || {});
                setAdStatus(ad.status || null);
                setAdRejectionReason(ad.rejectionReason);
                setAdExpiresAt(ad.expiresAt);
                
                // Parse availability if possible, else leave defaults
                if (ad.availability) {
                    const raw = ad.availability.toLowerCase();
                    if (raw.includes('24h') || raw.includes('24 horas')) {
                        setAvailabilityType('24h');
                    } else if (raw.includes('emergencia') || raw.includes('emergência') || raw.includes('plantao') || raw.includes('plantão')) {
                        setAvailabilityType('emergency');
                    } else {
                        setAvailabilityType('standard');
                        if (ad.availability.includes(':') && (ad.availability.includes('Seg:') || ad.availability.includes('Sáb:') || ad.availability.includes('Sab:') || ad.availability.includes('Ter:'))) {
                            setCustomDailyHours(true);
                            const blocks = parseAllScheduleBlocks(ad.availability);
                            const activeDays: string[] = [];
                            const newDaily: Record<string, { start: string; end: string }> = { ...dailyHours };
                            for (const b of blocks) {
                                for (const day of b.days) {
                                    activeDays.push(day);
                                    newDaily[day] = { start: b.startStr, end: b.endStr };
                                }
                            }
                            if (activeDays.length > 0) setSelectedDays(Array.from(new Set(activeDays)));
                            setDailyHours(newDaily);
                        } else {
                            const parts = ad.availability.split(',');
                            const timePart = parts[parts.length - 1].trim(); // "08:00 - 18:00"
                            if (timePart.includes('-')) {
                                const times = timePart.split('-');
                                setHoursStart(times[0].trim());
                                setHoursEnd(times[1].trim());
                            }
                        }
                    }
                }
            } else {
                navigate('/dashboard'); // Not authorized or doesn't exist
            }
            setLoadingAd(false);
        });
    }
  }, [id, isEditing, user, navigate]);

  // Redirect if not logged in
  if (!user) {
    return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Você precisa estar logado</h2>
                <p className="mb-6 text-gray-600">Para anunciar seus serviços, faça login ou crie uma conta.</p>
                <button onClick={() => navigate('/login')} className="bg-brand-600 text-white px-6 py-2 rounded-md">Ir para Login</button>
            </div>
        </div>
    )
  }

  // Redirect or show pending state if user is CLIENT
  if (user.role === 'CLIENT') {
    const isPendingProvider = user.roleRequest === 'PROVIDER';

    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-blue-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-5">
            {isPendingProvider ? <Clock className="w-8 h-8 animate-pulse text-brand-600" /> : <Info className="w-8 h-8 text-brand-600" />}
          </div>
          
          <h2 className="text-2xl font-bold mb-3 text-gray-900">
            {isPendingProvider ? 'Cadastro de Profissional em Análise' : 'Deseja oferecer seus serviços no Mestrio?'}
          </h2>
          
          <p className="mb-6 text-gray-600 leading-relaxed text-sm">
            {isPendingProvider
              ? 'Recebemos sua solicitação para se tornar um prestador no Mestrio! Nossa moderação está validando seu cadastro para garantir total segurança e confiabilidade na plataforma. Em breve você poderá publicar seus anúncios.'
              : 'Sua conta atual está configurada como Cliente contratante. Para criar anúncios públicos de serviços e receber solicitações, você pode solicitar a ativação do perfil profissional.'}
          </p>

          {isPendingProvider && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left text-xs text-amber-800 flex items-start gap-3">
              <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Dica para agilizar sua aprovação:</span>
                Mantenha seu perfil completo com foto, biografia detalhada e número de WhatsApp atualizado no seu painel.
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={() => navigate('/perfil/editar')} 
              className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
            >
              Completar Meu Perfil
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }


  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast("Seu navegador não suporta geolocalização.", 'error');
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await response.json();
          
          if (data && data.address) {
            const addr = data.address;
            const neighborhood = addr.suburb || addr.neighbourhood || addr.district || '';
            const city = addr.city || addr.town || addr.village || '';
            const state = addr.state || '';
            
            let locationStr = '';
            if (neighborhood && city && state) {
              locationStr = `${neighborhood}, ${city} - ${state}`;
            } else if (city && state) {
              locationStr = `${city} - ${state}`;
            } else {
              locationStr = data.display_name.split(',').slice(0, 3).join(',');
            }
            
            setFormData(prev => ({ ...prev, location: locationStr, lat: parseFloat(data.lat), lng: parseFloat(data.lon) }));
          }
        } catch (error) {
          console.error("Erro ao buscar endereço:", error);
          toast("Não foi possível buscar seu endereço automaticamente.", 'error');
        } finally {
          setLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Erro de geolocalização:", error);
        toast("Permissão de localização negada ou indisponível.", 'error');
        setLoadingLocation(false);
      }
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDayToggle = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files: File[] = Array.from(e.target.files);
    const limitCheck = validateUploadCount(images.length, files);
    if (!limitCheck.valid) {
      toast(limitCheck.message || 'Não foi possível anexar as imagens.', 'error');
      logSecurityWarning('upload.limit', 'Tentativa de envio excedeu o limite', { currentCount: images.length, incomingCount: files.length });
      return;
    }

    setIsCompressing(true);
    for (const file of files) {
      const validation = await validateUploadFileContent(file);
      if (!validation.valid) {
        toast(validation.message || 'Imagem inválida.', 'error');
        logSecurityWarning('upload.invalid', 'Upload bloqueado por validação', { fileName: file.name, reason: validation.message });
        continue;
      }

      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: false,
        };
        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onloadend = () => {
            if (reader.result) {
              setImages(prev => [...prev, reader.result as string]);
              setImageFiles(prev => [...prev, compressedFile]);
            }
            resolve();
          };
          reader.readAsDataURL(compressedFile);
        });
      } catch (error) {
        console.error('Erro na compressão da imagem:', error);
        toast('Erro ao processar a imagem.', 'error');
      }
    }
    setIsCompressing(false);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleGenerateDescription = async () => {
    if (!formData.title) {
        setGenerationError('Digite um título primeiro.');
        return;
    }
    
    setIsGenerating(true);
    setGenerationError('');
    
    // Suggest category first
    const suggestedCat = await suggestCategory(formData.title);
    if (suggestedCat && options.some(c => c.id === suggestedCat)) {
        setFormData(prev => ({ ...prev, category: suggestedCat }));
    }

    // Generate text
    const desc = await generateServiceDescription(formData.title, formData.category, formData.keywords || formData.title);
    
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      if (!formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
        throw new Error('Preencha título, descrição e localização.');
      }

      if (formData.whatsapp && formData.whatsapp.replace(/\D/g, '').length < 10) {
        throw new Error('Número de WhatsApp inválido.');
      }

      // Verificação de Segurança e Conteúdo Proibido (Sexualidade, Fraudes, etc.)
      const safetyCheck = analyzeAdSafety({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: Number(formData.price) || 0,
        priceUnit: formData.priceUnit as 'job' | 'hour' | 'estimate',
        tags: tags
      });

      if (safetyCheck.isCriticalBlocked) {
        logSecurityWarning('ad.content_blocked', 'Anúncio bloqueado por violação das diretrizes de segurança', {
          flags: safetyCheck.flags,
          categories: safetyCheck.categoriesDetected,
          userId: user.id
        });
        throw new Error(safetyCheck.userMessage || 'Seu anúncio contém termos não permitidos pelas diretrizes do Mestrio.');
      }

      // Upload new images to Supabase Storage (keep existing URLs in edit mode)
      const finalImages: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = imageFiles[i];
        if (file) {
          const url = await uploadImage(file);
          finalImages.push(url);
        } else {
          finalImages.push(images[i]);
        }
      }

      // Format availability string (Flexível: 24h, Emergência, Global ou por Dia)
      let availabilityString = '';
      if (availabilityType === '24h') {
        availabilityString = 'Atendimento 24 Horas';
      } else if (availabilityType === 'emergency') {
        availabilityString = 'Plantão de Emergências 24h';
      } else if (customDailyHours) {
        const dayStrings = selectedDays.map(d => {
          const dayInfo = DAYS_OF_WEEK.find(item => item.id === d);
          const dHours = dailyHours[d] || { start: '08:00', end: '18:00' };
          return `${dayInfo?.label || d}: ${dHours.start} - ${dHours.end}`;
        });
        availabilityString = dayStrings.length > 0 ? dayStrings.join(', ') : 'Horário Comercial';
      } else {
        const selectedDayLabels = selectedDays.map(id => DAYS_OF_WEEK.find(d => d.id === id)?.label).filter(Boolean).join(', ');
        availabilityString = selectedDays.length > 0 ? `${selectedDayLabels}, ${hoursStart} - ${hoursEnd}` : 'Horário Comercial';
      }

      if (isEditing && id) {
          await store.updateAd(id, {
              title: formData.title,
              description: formData.description,
              category: formData.category,
              price: Number(formData.price) || 0,
              priceUnit: formData.priceUnit as 'job' | 'hour' | 'estimate',
              location: formData.location,
              lat: formData.lat || undefined,
              lng: formData.lng || undefined,
              whatsapp: formData.whatsapp,
              images: finalImages.length > 0 ? finalImages : undefined,
              availability: availabilityString,
              tags: tags,
              customAttributes: customAttributes,
              riskScore: safetyCheck.riskScore,
              safetyFlags: safetyCheck.flags,
              safetyCategories: safetyCheck.categoriesDetected
          });
          if (adStatus === 'rejected') {
              await store.updateAdStatus(id, 'pending');
              toast('Alterações enviadas para nova revisão!', 'success');
          } else {
              toast('Anúncio atualizado com sucesso!', 'success');
          }
          navigate('/dashboard');
      } else {
          const newAd = await store.addAd({
              providerId: user.id,
              title: formData.title,
              description: formData.description,
              category: formData.category,
              price: Number(formData.price) || 0,
              priceUnit: formData.priceUnit as 'job' | 'hour' | 'estimate',
              location: formData.location,
              lat: formData.lat || undefined,
              lng: formData.lng || undefined,
              whatsapp: formData.whatsapp,
              images: finalImages.length > 0 ? finalImages : ['https://picsum.photos/400/300?random=' + Math.floor(Math.random() * 100)],
              isPremium: false,
              availability: availabilityString,
              tags: tags,
              customAttributes: customAttributes,
              riskScore: safetyCheck.riskScore,
              safetyFlags: safetyCheck.flags,
              safetyCategories: safetyCheck.categoriesDetected
          });
          toast('Anúncio enviado para análise. Ele será publicado após a aprovação.', 'success');
          navigate('/dashboard');
      }
    } catch (err: any) {
      console.error("Erro ao salvar anúncio:", err);
      logSecurityError('ad.create_failed', 'Falha ao criar/editar anúncio', { message: err?.message, isEditing }, user?.id);
      toast(err?.message || 'Não foi possível salvar o anúncio. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAd) {
      return <div className="flex-1 flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;
  }

  return (
    <div className="flex-1 bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-brand-700 py-6 px-8">
                <h1 className="text-2xl font-bold text-white">{isEditing ? 'Editar Anúncio' : 'Anunciar Serviço'}</h1>
                <p className="text-brand-100">{isEditing ? 'Atualize as informações do seu serviço.' : 'Preencha os dados para que clientes te encontrem na sua região.'}</p>
            </div>

            {isEditing && adStatus && adStatus !== 'approved' && (
                <div className={`mx-8 mt-6 px-4 py-3 rounded-lg border flex items-start gap-2 text-sm ${
                    adStatus === 'rejected'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                    {adStatus === 'rejected'
                        ? <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        : <Info size={18} className="shrink-0 mt-0.5" />}
                    <div>
                        {adStatus === 'pending' && (
                            <>
                                <strong>Anúncio em análise.</strong> Ele ainda não está visível para o público. Você pode editar enquanto aguarda a aprovação.
                            </>
                        )}
                        {adStatus === 'rejected' && (
                            <>
                                <strong>Anúncio rejeitado.</strong> Corrija as pendências abaixo e salve para reenviar à revisão.
                                {adRejectionReason && <p className="mt-1 text-xs"><strong>Motivo:</strong> {adRejectionReason}</p>}
                            </>
                        )}
                        {adStatus === 'suspended' && (
                            <>
                                <strong>Anúncio suspenso.</strong> Contate o suporte para resolver a situação.
                                {adRejectionReason && <p className="mt-1 text-xs"><strong>Motivo:</strong> {adRejectionReason}</p>}
                            </>
                        )}
                        {adStatus === 'expired' && (
                            <>
                                <strong>Anúncio expirado.</strong> Salve as alterações para solicitar a renovação na moderação.
                            </>
                        )}
                    </div>
                </div>
            )}
            {isEditing && adStatus === 'approved' && adExpiresAt && (
                <div className="mx-8 mt-6 px-4 py-3 rounded-lg border border-green-100 bg-green-50 text-green-700 text-sm flex items-center gap-2">
                    <Info size={18} className="shrink-0" />
                    Anúncio ativo. Expira em {new Date(adExpiresAt).toLocaleDateString('pt-BR')}.
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                
                {/* Basic Info */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Título do Serviço</label>
                        <span className="text-xs text-gray-400">{formData.title.length}/100</span>
                    </div>
                    <input 
                        type="text" 
                        name="title"
                        required
                        maxLength={100}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-500 focus:border-brand-500"
                        placeholder="Ex: Troca de torneira, Instalação elétrica, Pintura de parede..."
                        value={formData.title}
                        onChange={handleInputChange}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                        <select 
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-500 focus:border-brand-500"
                        >
                            {options.filter(c => c.id !== 'all').map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Região de Atendimento (Domicílio)</label>
                            <button 
                                type="button"
                                onClick={handleGetLocation}
                                disabled={loadingLocation}
                                className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center disabled:opacity-50"
                            >
                                {loadingLocation ? <Loader2 size={12} className="animate-spin mr-1" /> : <LocateFixed size={12} className="mr-1" />}
                                Usar GPS
                            </button>
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                name="location"
                                required
                                className="w-full border border-gray-300 rounded-md p-2 pl-8 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="Ex: Pinheiros, São Paulo - SP"
                                value={formData.location}
                                onChange={handleInputChange}
                            />
                            <MapPin className="absolute left-2.5 top-2.5 text-gray-400 w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* Diferenciais Técnicos por Especialidade (Directorist Pattern) */}
                {(() => {
                    const categoryAttrs = getCategoryAttributes(formData.category);
                    if (categoryAttrs.length === 0) return null;
                    return (
                        <div className="bg-brand-50/50 rounded-2xl p-4 sm:p-5 border border-brand-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                                        <Sparkles size={16} className="text-amber-500" /> Diferenciais Técnicos da Especialidade
                                    </h4>
                                    <p className="text-xs text-brand-700">Marque suas qualificações e diferenciais para ganhar mais destaque.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                {categoryAttrs.map((attr) => {
                                    const checked = !!customAttributes[attr.id];
                                    return (
                                        <label
                                            key={attr.id}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                                checked ? 'bg-white border-brand-400 shadow-2xs ring-1 ring-brand-200' : 'bg-white/60 border-gray-200 hover:bg-white'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    const isChecked = e.target.checked;
                                                    setCustomAttributes(prev => ({
                                                        ...prev,
                                                        [attr.id]: isChecked,
                                                    }));
                                                    if (isChecked && !tags.includes(attr.label)) {
                                                        setTags(prev => [...prev, attr.label]);
                                                    }
                                                }}
                                                className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-bold text-gray-900 block leading-snug">{attr.label}</span>
                                                <span className="text-[11px] text-gray-500 leading-tight block mt-0.5">{attr.description}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* Photos Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fotos do Serviço</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-brand-400 transition-colors">
                        <input 
                            type="file" 
                            id="photo-upload" 
                            multiple 
                            accept="image/*"
                            className="hidden" 
                            onChange={handleImageUpload}
                            disabled={isCompressing}
                        />
                        <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center justify-center">
                            {isCompressing ? (
                                <>
                                    <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-2" />
                                    <span className="text-sm text-brand-600 font-medium">Otimizando e comprimindo imagens...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-600 font-medium">Clique para adicionar fotos</span>
                                    <span className="text-xs text-gray-400 mt-1">PNG, JPG (Compressão automática inteligente)</span>
                                </>
                            )}
                        </label>
                    </div>
                    
                    {images.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tags Section */}
                <div className="bg-white">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags do Serviço (Opcional)</label>
                    <p className="text-xs text-gray-500 mb-2">Digite uma característica (ex: urgente, material incluso) e aperte Enter ou Vírgula.</p>
                    <div className="border border-gray-300 rounded-md p-2 focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500 flex flex-wrap gap-2 items-center bg-white">
                        {tags.map(tag => (
                            <span key={tag} className="flex items-center bg-brand-50 text-brand-700 text-sm px-2 py-1 rounded-md border border-brand-100">
                                {tag}
                                <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-brand-500 hover:text-brand-800">
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                        <input 
                            type="text" 
                            className="flex-1 outline-none min-w-[120px] text-sm p-1"
                            placeholder={tags.length === 0 ? "Adicionar tag..." : ""}
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                        />
                    </div>
                </div>

                {/* AI Assistant Section */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 relative">
                    <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full flex items-center shadow-sm">
                        <Sparkles size={12} className="mr-1" /> IA Assistant
                    </div>
                    
                    <div className="mt-2 mb-3">
                         <label className="block text-sm font-medium text-indigo-900 mb-1">Palavras-chave (Opcional)</label>
                         <input 
                            type="text" 
                            name="keywords"
                            placeholder="Ex: atendimento rápido, garantia do serviço, material incluso"
                            className="w-full border border-indigo-200 rounded-md p-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                            value={formData.keywords}
                            onChange={handleInputChange}
                         />
                         <p className="text-xs text-indigo-600 mt-1">Ajuda a IA a criar uma descrição mais precisa.</p>
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={isGenerating}
                        className="flex items-center justify-center w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? 'Gerando...' : (
                            <>
                                <Wand2 size={16} className="mr-2" /> Gerar Descrição com IA
                            </>
                        )}
                    </button>
                    {generationError && <p className="text-red-500 text-xs mt-2">{generationError}</p>}
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Descrição Detalhada</label>
                        <span className="text-xs text-gray-400">{formData.description.length} caracteres</span>
                    </div>
                    <textarea 
                        name="description"
                        required
                        rows={6}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-500 focus:border-brand-500"
                        placeholder="Descreva seus serviços, diferenciais e experiência..."
                        value={formData.description}
                        onChange={handleInputChange}
                    />
                </div>

                {/* Availability Section (Modos 24h, Emergência ou Horário Flexível por Dia) */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center">
                            <Calendar size={18} className="mr-2 text-brand-600"/> Regime & Horários de Atendimento
                        </h3>
                    </div>

                    {/* 3 Opções de Regime */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                            type="button"
                            onClick={() => setAvailabilityType('standard')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                availabilityType === 'standard'
                                    ? 'bg-white border-brand-600 shadow-2xs ring-2 ring-brand-100'
                                    : 'bg-white/70 border-gray-200 hover:bg-white text-gray-600'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Clock size={16} className={availabilityType === 'standard' ? 'text-brand-600' : 'text-gray-400'} />
                                <span className="font-bold text-xs text-gray-900">Horário Comercial</span>
                            </div>
                            <p className="text-[11px] text-gray-500">Dias e horários programados</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setAvailabilityType('24h')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                availabilityType === '24h'
                                    ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs ring-2 ring-emerald-100'
                                    : 'bg-white/70 border-gray-200 hover:bg-white text-gray-600'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="font-bold text-xs text-gray-900">Atendimento 24h</span>
                            </div>
                            <p className="text-[11px] text-gray-500">Sempre aberto ininterrupto</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setAvailabilityType('emergency')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                availabilityType === 'emergency'
                                    ? 'bg-rose-50/80 border-rose-500 shadow-2xs ring-2 ring-rose-100'
                                    : 'bg-white/70 border-gray-200 hover:bg-white text-gray-600'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <span className="font-bold text-xs text-gray-900">Plantão Emergências</span>
                            </div>
                            <p className="text-[11px] text-gray-500">Chamados urgentes 24h</p>
                        </button>
                    </div>

                    {/* Conteúdo específico por Regime */}
                    {availabilityType === '24h' && (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
                            <Clock size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold block mb-0.5">Disponibilidade Total 24 Horas Ativa</strong>
                                Os horários manuais são dispensados. Seu anúncio exibirá a tag de destaque <strong>🟢 24 Horas</strong> no topo das buscas e no perfil.
                            </div>
                        </div>
                    )}

                    {availabilityType === 'emergency' && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                            <Clock size={16} className="text-rose-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold block mb-0.5">Plantão de Emergências 24h Ativo</strong>
                                Indicado para eletricistas, encanadores, chaveiros e socorros rápidos com tag <strong>🚨 Emergências</strong>.
                            </div>
                        </div>
                    )}

                    {availabilityType === 'standard' && (
                        <div className="space-y-4 pt-1">
                            {/* Seleção dos dias da semana */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Selecione os Dias que Você Trabalha:</label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map(day => {
                                        const isSelected = selectedDays.includes(day.id);
                                        return (
                                            <button
                                                type="button"
                                                key={day.id}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        if (selectedDays.length > 1) {
                                                            setSelectedDays(selectedDays.filter(d => d !== day.id));
                                                        }
                                                    } else {
                                                        setSelectedDays([...selectedDays, day.id]);
                                                    }
                                                }}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                                    isSelected
                                                        ? 'bg-brand-600 text-white border-brand-600 shadow-2xs'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {day.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Switch de Personalização por dia */}
                            <div className="pt-2 border-t border-gray-200">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={customDailyHours}
                                        onChange={(e) => setCustomDailyHours(e.target.checked)}
                                        className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-bold text-gray-800">
                                        Definir horário diferente para cada dia (ex: Sábado meio período)
                                    </span>
                                </label>
                            </div>

                            {!customDailyHours ? (
                                /* Horário Único para todos os dias */
                                <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Horário de Início (Das)</label>
                                        <input 
                                            type="time" 
                                            value={hoursStart}
                                            onChange={(e) => setHoursStart(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-brand-500 focus:border-brand-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Horário de Encerramento (Até)</label>
                                        <input 
                                            type="time" 
                                            value={hoursEnd}
                                            onChange={(e) => setHoursEnd(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-brand-500 focus:border-brand-500"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* Horários Individuais por Dia Marcado */
                                <div className="space-y-2 bg-white p-3.5 rounded-xl border border-gray-200">
                                    <p className="text-[11px] text-gray-500 mb-1">Ajuste o início e fim de cada dia marcado:</p>
                                    {selectedDays.map(dayId => {
                                        const dayInfo = DAYS_OF_WEEK.find(d => d.id === dayId);
                                        const cur = dailyHours[dayId] || { start: '08:00', end: '18:00' };
                                        return (
                                            <div key={dayId} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                                                <span className="text-xs font-bold text-gray-800 w-24">{dayInfo?.fullName || dayId}</span>
                                                <div className="flex items-center gap-2 flex-1 justify-end">
                                                    <input
                                                        type="time"
                                                        value={cur.start}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setDailyHours(prev => ({
                                                                ...prev,
                                                                [dayId]: { ...(prev[dayId] || { end: '18:00' }), start: val }
                                                            }));
                                                        }}
                                                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-brand-500"
                                                    />
                                                    <span className="text-xs text-gray-400">às</span>
                                                    <input
                                                        type="time"
                                                        value={cur.end}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setDailyHours(prev => ({
                                                                ...prev,
                                                                [dayId]: { ...(prev[dayId] || { start: '08:00' }), end: val }
                                                            }));
                                                        }}
                                                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-brand-500"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                        <input 
                            type="number" 
                            name="price"
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="0 para 'A combinar'"
                            value={formData.price}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cobrança</label>
                        <select 
                            name="priceUnit"
                            value={formData.priceUnit}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-500 focus:border-brand-500"
                        >
                            <option value="job">Por Serviço</option>
                            <option value="hour">Por Hora</option>
                            <option value="estimate">Orçamento</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp para Contato</label>
                        <input 
                            type="text" 
                            name="whatsapp"
                            required
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="5511999999999"
                            value={formData.whatsapp}
                            onChange={handleInputChange}
                        />
                        <p className="text-xs text-gray-500 mt-1">Com DDI e DDD (ex: 5511999999999).</p>
                    </div>
                </div>

                {/* Security Guidelines Notice */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <strong className="text-slate-800 font-semibold block mb-0.5">Diretrizes da Comunidade Mestrio:</strong>
                        É estritamente proibido anunciar conteúdo adulto, acompanhantes, serviços de cunho sexual, esquemas de renda fácil/fraudes financeiras ou preços irreais. Todos os anúncios passam por verificação automática e moderação ativa.
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end">
                    <button 
                        type="button" 
                        onClick={() => navigate('/')}
                        className="mr-4 px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-bold shadow-sm disabled:opacity-50"
                    >
                        {submitting ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Enviar para Análise')}
                    </button>
                </div>

            </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAd;
