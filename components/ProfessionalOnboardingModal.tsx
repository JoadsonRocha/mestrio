import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle2, ShieldCheck, User as UserIcon, Phone, MapPin, Briefcase, FileText, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { store, uploadImage } from '../services/store';

/**
 * Propriedades do modal de onboarding profissional.
 */
interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  submitButtonText?: string;
  mode?: 'onboarding' | 'request_provider' | 'request_verification';
  closable?: boolean;
  onSuccess?: () => void;
}

/**
 * Modal multifuncional utilizado para:
 * 1. Coletar dados extras (telefone, bio) no primeiro login do profissional (Onboarding).
 * 2. Permitir que um cliente solicite conversão para conta profissional (Request Provider).
 * 3. Solicitar selo de verificação KYC através de envio de documento (Request Verification).
 */
export const ProfessionalOnboardingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  submitButtonText,
  mode = 'onboarding',
  closable = true,
  onSuccess
}) => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  // Para verificação de documento (KYC)
  const [documentType, setDocumentType] = useState<'CPF' | 'CNH' | 'RG'>('CPF');
  const [docFrontFile, setDocFrontFile] = useState<File | null>(null);
  const [docFrontPreview, setDocFrontUrlPreview] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const getDraftKey = (userId: string) => `mestrio_onboarding_draft_${userId}`;

  useEffect(() => {
    if (user) {
      // Se existir rascunho, restaura o que o usuário digitou antes de sair da página.
      let draft: any = null;
      try {
        draft = JSON.parse(localStorage.getItem(getDraftKey(user.id)) || 'null');
      } catch { /* rascunho corrompido: ignora */ }

      setPhone(draft?.phone ?? user.phone ?? '');
      setLocation(draft?.location ?? user.location ?? '');
      setBio(draft?.bio ?? user.bio ?? '');
      setDocumentNumber(draft?.documentNumber ?? user.documentNumber ?? '');
      setAvatar(draft?.avatar ?? user.avatar ?? '');
      setHydrated(true);
    }
  }, [user, isOpen]);

  // Salva o rascunho a cada alteração para não perder o que foi digitado.
  useEffect(() => {
    if (!user || !isOpen || !hydrated) return;
    try {
      localStorage.setItem(getDraftKey(user.id), JSON.stringify({
        phone,
        location,
        bio,
        documentNumber,
        avatar,
      }));
    } catch { /* sem espaço no localStorage: segue sem persistir */ }
  }, [user, isOpen, hydrated, phone, location, bio, documentNumber, avatar]);

  if (!isOpen || !user) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatar(URL.createObjectURL(file));
    }
  };

  const handleDocFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocFrontFile(file);
      setDocFrontUrlPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      toast('Informe um telefone/WhatsApp válido com DDD.', 'error');
      return;
    }

    if (!location.trim()) {
      toast('Informe a sua cidade e estado de atendimento.', 'error');
      return;
    }

    if (!bio.trim() || bio.trim().length < 15) {
      toast('Escreva uma breve descrição/experiência sobre o seu trabalho (mínimo 15 caracteres).', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let finalAvatar = avatar;
      if (avatarFile) {
        finalAvatar = await uploadImage(avatarFile, 'avatars');
      }

      // 1. Atualiza dados do Perfil
      await store.updateProfile(user.id, {
        phone,
        location,
        bio,
        avatar: finalAvatar,
        documentNumber,
        hasCompletedOnboarding: true,
      });

      // 2. Trata modos específicos
      if (mode === 'request_provider') {
        await store.requestProviderRole();
        toast('Sua solicitação para ser Profissional foi enviada! A administração analisará seu perfil.', 'success');
      } else if (mode === 'request_verification') {
        if (docFrontFile) {
          const docUrl = await uploadImage(docFrontFile, 'avatars');
          await store.submitKYCDocument({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            documentType,
            documentNumber: documentNumber || 'Não informado',
            documentFrontUrl: docUrl,
          });
          toast('Solicitação de Selo de Verificação enviada com sucesso! Aguarde a aprovação do Admin.', 'success');
        } else {
          // Envia pedido de verificação padrão
          await store.submitKYCDocument({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            documentType,
            documentNumber: documentNumber || 'Não informado',
            documentFrontUrl: finalAvatar || 'https://via.placeholder.com/150',
          });
          toast('Solicitação de Selo de Verificação enviada! A administração analisará sua ficha.', 'success');
        }
      } else {
        toast('Informações do perfil profissional salvas com sucesso!', 'success');
      }

      await refreshUser();
      try { localStorage.removeItem(getDraftKey(user.id)); } catch { /* ok */ }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast(err?.message || 'Erro ao salvar informações.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = title || (
    mode === 'request_provider'
      ? 'Ficha de Cadastro de Profissional'
      : mode === 'request_verification'
      ? 'Solicitar Selo de Profissional Verificado'
      : 'Complete seu Perfil Profissional'
  );

  const modalSubtitle = subtitle || (
    mode === 'request_provider'
      ? 'Preencha os dados do seu trabalho para que a administração possa aprovar sua conta de Profissional.'
      : mode === 'request_verification'
      ? 'Confirme seus dados e envie para obter o selo azul de verificação no seu perfil.'
      : 'Adicione suas informações e contatos para que clientes encontrem seus serviços facilmente.'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto border border-gray-100">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-3 border-gray-100">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 mb-1">
              <Sparkles size={12} /> {mode === 'request_verification' ? 'Selo de Confiança' : 'Perfil do Prestador'}
            </span>
            <h2 className="text-xl font-extrabold text-gray-900 leading-tight">{modalTitle}</h2>
            <p className="text-xs text-gray-500 mt-1">{modalSubtitle}</p>
          </div>
          {closable && (
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <X size={20} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Avatar Upload */}
          <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="relative shrink-0">
              <img
                src={avatar || 'https://via.placeholder.com/100'}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-brand-500/20 shadow-sm"
              />
              <label htmlFor="avatar-file" className="absolute bottom-0 right-0 bg-brand-600 text-white p-1 rounded-full cursor-pointer hover:bg-brand-700 shadow">
                <Upload size={12} />
              </label>
              <input id="avatar-file" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">Foto de Perfil Profissional</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Fotos nítidas transmitem mais confiança para os clientes.</p>
            </div>
          </div>

          {/* Telefone / WhatsApp */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center">
              <Phone size={14} className="mr-1 text-brand-600" /> WhatsApp / Telefone de Contato
            </label>
            <input
              type="text"
              required
              placeholder="Ex: (11) 99999-9999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Cidade e Estado */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center">
              <MapPin size={14} className="mr-1 text-brand-600" /> Cidade e Estado de Atendimento
            </label>
            <input
              type="text"
              required
              placeholder="Ex: São Paulo - SP"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Biografia / Descrição do Trabalho */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center">
              <Briefcase size={14} className="mr-1 text-brand-600" /> Apresentação / Experiência com Serviços
            </label>
            <textarea
              required
              rows={3}
              placeholder="Descreva sua experiência, especialidades, garantias e anos de atuação..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* CPF / CNPJ */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center">
              <FileText size={14} className="mr-1 text-brand-600" /> CPF ou CNPJ
            </label>
            <input
              type="text"
              placeholder="Ex: 000.000.000-00"
              value={documentNumber}
              onChange={e => setDocumentNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">Armazenado com segurança para verificação administrativa.</p>
          </div>

          {/* Seção extra se pedir Selo de Verificação */}
          {mode === 'request_verification' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-blue-900 text-xs font-bold">
                <ShieldCheck size={16} className="text-blue-600" /> Anexo de Documento para Selo de Verificação
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value as any)}
                  className="border border-blue-200 rounded-lg p-2 text-xs bg-white"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNH">CNH</option>
                  <option value="RG">RG</option>
                </select>
                <label className="border border-dashed border-blue-300 rounded-lg p-2 text-center text-xs text-blue-700 font-semibold cursor-pointer bg-white hover:bg-blue-100/50 flex items-center justify-center">
                  <Upload size={12} className="mr-1" /> {docFrontFile ? 'Foto Carregada' : 'Foto do Documento'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleDocFrontChange} />
                </label>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-3 border-t flex justify-end gap-2">
            {closable && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition flex items-center disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" /> Salvando...
                </>
              ) : (
                submitButtonText || (mode === 'request_verification' ? 'Enviar para Verificação' : 'Salvar Informações')
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
