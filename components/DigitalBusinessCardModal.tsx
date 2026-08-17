import React, { useState, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Phone,
  Mail,
  MapPin,
  Star,
  ShieldCheck,
  QrCode,
  Sparkles,
  ExternalLink,
  MessageCircle,
  FileImage,
  Layers,
  Quote
} from 'lucide-react';
import { User, ServiceAd } from '../types';
import { useToast } from '../context/ToastContext';
import { VerifiedBadge } from './VerifiedBadge';

interface DigitalBusinessCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  ads?: ServiceAd[];
}

export const DigitalBusinessCardModal: React.FC<DigitalBusinessCardModalProps> = ({
  isOpen,
  onClose,
  user,
  ads = [],
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isExportingJPEG, setIsExportingJPEG] = useState(false);
  const [isExportingSVG, setIsExportingSVG] = useState(false);

  if (!isOpen) return null;

  const profileUrl = `${window.location.origin}/profissional/${user.id}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(profileUrl)}&color=0f172a&bgcolor=ffffff`;

  const bioText = user.bio?.trim() || 'Profissional qualificado e comprometido em prestar serviços de excelência com garantia, agilidade e pontualidade.';
  const categories = Array.from(new Set(ads.map(a => a.category))).slice(0, 3);
  const avgRating = ads.length > 0
    ? (ads.reduce((acc, a) => acc + (a.rating || 5), 0) / ads.length).toFixed(1)
    : '5.0';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast('Link do seu perfil copiado com sucesso!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShareWhatsApp = () => {
    const text = `🛠️ *${user.name}* - Profissional no Mestrio\n\n_"${bioText}"_\n\n⭐ Avaliação: ${avgRating} estrelas\n📍 Local: ${user.location || 'Atendimento Geral'}\n\nConfira meu perfil, serviços e solicite um orçamento direto pelo link:\n${profileUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- GERAÇÃO E DOWNLOAD EM JPEG (ALTA RESOLUÇÃO CANVAS) ---
  const handleDownloadJPEG = async () => {
    setIsExportingJPEG(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível inicializar o canvas.');

      canvas.width = 800;
      canvas.height = 1050;

      // 1. Background com Gradiente Elegante
      const bgGrad = ctx.createLinearGradient(0, 0, 800, 1050);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#1e1b4b');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 800, 1050);

      // Círculos de iluminação decorativos
      ctx.save();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.beginPath();
      ctx.arc(700, 100, 250, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      ctx.beginPath();
      ctx.arc(100, 950, 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Borda decorativa do cartão
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 760, 1010);

      // 2. Header: Logo Mestrio Pro & Selo Verificado
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillText('MESTRIO PRO', 50, 75);

      if (user.isCertified) {
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.roundRect(580, 50, 170, 36, 18);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillText('✓ VERIFICADO', 605, 74);
      }

      // 3. Avatar do Profissional (com carregamento assíncrono seguro)
      const avatarX = 50;
      const avatarY = 115;
      const avatarSize = 130;

      const drawAvatarFallback = () => {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 24);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 50px Arial, sans-serif';
        ctx.fillText((user.name || 'P').charAt(0).toUpperCase(), avatarX + 45, avatarY + 85);
      };

      if (user.avatar) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = user.avatar!;
          });
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 24);
          ctx.clip();
          ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();
        } catch {
          drawAvatarFallback();
        }
      } else {
        drawAvatarFallback();
      }

      // Moldura do Avatar
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 24);
      ctx.stroke();

      // 4. Nome do Profissional e Avaliação
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText(user.name, 210, 160);

      // Estrelas
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText(`★ ${avgRating} / 5.0`, 210, 195);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText(`(${ads.length} ${ads.length === 1 ? 'anúncio ativo' : 'anúncios ativos'})`, 330, 195);

      // Localização
      if (user.location) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '17px Arial, sans-serif';
        ctx.fillText(`📍 ${user.location}`, 210, 230);
      }

      // 5. Categorias / Especialidades em Tags
      if (categories.length > 0) {
        let tagX = 50;
        const tagY = 275;
        for (const cat of categories) {
          const textWidth = ctx.measureText(cat).width + 30;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, textWidth, 34, 10);
          ctx.fill();

          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 15px Arial, sans-serif';
          ctx.fillText(cat, tagX + 15, tagY + 23);
          tagX += textWidth + 12;
        }
      }

      // 6. CAIXA COM A BIO DO PROFISSIONAL (DESTAQUE)
      const bioBoxY = categories.length > 0 ? 335 : 280;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(50, bioBoxY, 700, 175, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillText('SOBRE O PROFISSIONAL & BIO:', 75, bioBoxY + 35);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'italic 18px Arial, sans-serif';
      
      // Quebra de linha de texto da bio
      const maxBioWidth = 650;
      const words = bioText.split(' ');
      let currentLine = '';
      let lineY = bioBoxY + 70;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxBioWidth && i > 0) {
          ctx.fillText(`"${currentLine.trim()}"`, 75, lineY);
          currentLine = words[i] + ' ';
          lineY += 28;
          if (lineY > bioBoxY + 145) break;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine && lineY <= bioBoxY + 150) {
        ctx.fillText(`"${currentLine.trim()}"`, 75, lineY);
      }

      // 7. QR CODE & INFORMAÇÕES DE CONTATO
      const bottomBoxY = bioBoxY + 205;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(50, bottomBoxY, 700, 360, 20);
      ctx.fill();

      // Contatos textuais
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('SOLICITE SEU ORÇAMENTO:', 80, bottomBoxY + 50);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText(`📱 WhatsApp: ${user.phone || 'Disponível no link'}`, 80, bottomBoxY + 95);

      if (user.email) {
        ctx.fillStyle = '#60a5fa';
        ctx.font = '18px Arial, sans-serif';
        ctx.fillText(`✉️ E-mail: ${user.email}`, 80, bottomBoxY + 135);
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText('🌐 Plataforma: www.mestrio.com.br', 80, bottomBoxY + 175);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillText('⚡ Orçamentos com Garantia & Pontualidade', 80, bottomBoxY + 225);

      // QR Code no canto direito
      const qrSize = 220;
      const qrX = 500;
      const qrY = bottomBoxY + 40;

      try {
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          qrImg.onload = resolve;
          qrImg.onerror = reject;
          qrImg.src = qrCodeImageUrl;
        });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 16);
        ctx.fill();
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } catch {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText('QR CODE', qrX + 65, qrY + 110);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText('Aponte a câmera para ver o perfil completo', 80, bottomBoxY + 310);

      // 8. Rodapé do Cartão
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Mestrio - Conectando Serviços Gerais e Manutenção Residencial', 400, 1000);
      ctx.textAlign = 'left';

      // 9. Converter para Blob e disparar Download ou Share
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Falha ao gerar imagem.');
        const cleanName = (user.name || 'Profissional').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Cartao_Digital_${cleanName}.jpeg`;

        // Se suportar Web Share API com arquivos no celular
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Cartão de Visitas - ${user.name}`,
              text: `Confira meus serviços no Mestrio! ${profileUrl}`,
              files: [file],
            });
            toast('Cartão compartilhado com sucesso!', 'success');
            return;
          } catch {
            // Se cancelar ou falhar, faz o download padrão
          }
        }

        // Download via link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Cartão em alta resolução (JPEG) baixado com sucesso!', 'success');
      }, 'image/jpeg', 0.95);

    } catch (e) {
      console.error(e);
      toast('Erro ao exportar cartão em JPEG.', 'error');
    } finally {
      setIsExportingJPEG(false);
    }
  };

  // --- GERAÇÃO E DOWNLOAD EM SVG (VETORIAL ESCALÁVEL) ---
  const handleDownloadSVG = () => {
    setIsExportingSVG(true);
    try {
      const cleanName = (user.name || 'Profissional').replace(/[^a-zA-Z0-9]/g, '_');
      const escapedName = (user.name || 'Profissional').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedBio = bioText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedLocation = (user.location || 'Atendimento Geral').replace(/&/g, '&amp;');
      const escapedPhone = (user.phone || 'Disponível no link').replace(/&/g, '&amp;');
      const escapedEmail = (user.email || '').replace(/&/g, '&amp;');

      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0095f6" />
      <stop offset="100%" stop-color="#1877f2" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="1050" fill="url(#cardBg)" rx="24" />
  <rect x="20" y="20" width="760" height="1010" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" rx="18" />

  <!-- Topo -->
  <text x="50" y="75" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="bold">MESTRIO PRO</text>
  ${user.isCertified ? `
  <rect x="580" y="48" width="170" height="36" rx="18" fill="#1d4ed8" />
  <text x="605" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">✓ VERIFICADO</text>
  ` : ''}

  <!-- Nome e Avaliação -->
  <text x="50" y="150" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="bold">${escapedName}</text>
  <text x="50" y="185" fill="#fbbf24" font-family="Arial, sans-serif" font-size="20" font-weight="bold">★ ${avgRating} / 5.0</text>
  <text x="180" y="185" fill="#94a3b8" font-family="Arial, sans-serif" font-size="16">(${ads.length} anúncios)</text>
  <text x="50" y="220" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="17">📍 ${escapedLocation}</text>

  <!-- Caixa de Bio -->
  <rect x="50" y="260" width="700" height="180" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
  <text x="75" y="295" fill="#93c5fd" font-family="Arial, sans-serif" font-size="15" font-weight="bold">SOBRE O PROFISSIONAL &amp; BIO:</text>
  <text x="75" y="335" fill="#f8fafc" font-family="Arial, sans-serif" font-size="17" font-style="italic">"${escapedBio.slice(0, 85)}</text>
  <text x="75" y="365" fill="#f8fafc" font-family="Arial, sans-serif" font-size="17" font-style="italic">${escapedBio.slice(85, 175)}"</text>

  <!-- Caixa de Contato & QR -->
  <rect x="50" y="470" width="700" height="460" rx="20" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
  <text x="80" y="520" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="bold">SOLICITE SEU ORÇAMENTO:</text>
  <text x="80" y="570" fill="#34d399" font-family="Arial, sans-serif" font-size="20" font-weight="bold">📱 WhatsApp: ${escapedPhone}</text>
  ${escapedEmail ? `<text x="80" y="610" fill="#60a5fa" font-family="Arial, sans-serif" font-size="18">✉️ E-mail: ${escapedEmail}</text>` : ''}
  <text x="80" y="650" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="16">🌐 Plataforma: www.mestrio.com.br</text>
  <text x="80" y="700" fill="#fbbf24" font-family="Arial, sans-serif" font-size="16" font-weight="bold">⚡ Orçamentos com Garantia &amp; Pontualidade</text>
  
  <text x="80" y="870" fill="#94a3b8" font-family="Arial, sans-serif" font-size="15">Acesse o perfil completo pelo link:</text>
  <text x="80" y="900" fill="#38bdf8" font-family="Arial, sans-serif" font-size="15" font-weight="bold">${profileUrl}</text>

  <!-- Rodapé -->
  <text x="400" y="980" fill="#64748b" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Mestrio - Conectando Serviços Gerais e Manutenção Residencial</text>
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cartao_Digital_${cleanName}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast('Cartão vetorial (SVG) baixado com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao exportar SVG.', 'error');
    } finally {
      setIsExportingSVG(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-amber-400" />
            <h3 className="font-bold text-sm">Cartão de Visita Digital Profissional</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cartão Visual para Apresentação */}
        <div className="p-6 space-y-5 bg-gray-50">
          <div
            className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-white/10"
          >
            {/* Background decorativo */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
              {/* Logo / Badge */}
              <div className="flex items-center justify-between">
                <span className="font-black tracking-wider text-xs uppercase bg-white/10 px-2.5 py-1 rounded-full text-blue-200 border border-white/10 flex items-center gap-1.5 shadow-2xs">
                  <Sparkles size={12} className="text-amber-400" /> MESTRIO PRO
                </span>
                {user.isCertified && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-200 bg-blue-900/80 px-2.5 py-0.5 rounded-full border border-blue-400/40 shadow-2xs">
                    <VerifiedBadge size={14} /> Verificado
                  </span>
                )}
              </div>

              {/* Informações do Profissional */}
              <div className="flex items-center gap-3.5 pt-1">
                <div className="relative">
                  <img
                    src={user.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`}
                    alt={user.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md bg-slate-800"
                  />
                  {user.isCertified && (
                    <span className="absolute -bottom-1 -right-1 bg-slate-900 p-0.5 rounded-full shadow-sm">
                      <VerifiedBadge size={16} />
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-lg text-white leading-tight flex items-center gap-1.5">
                    <span>{user.name}</span>
                    {user.isCertified && <VerifiedBadge size="sm" />}
                  </h4>
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold mt-0.5">
                    <Star size={13} fill="currentColor" />
                    <span>{avgRating}</span>
                    <span className="text-slate-400 font-normal">({ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'})</span>
                  </div>
                  {user.location && (
                    <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                      <MapPin size={11} className="text-blue-400" /> {user.location}
                    </p>
                  )}
                </div>
              </div>

              {/* BIO / DESCRIÇÃO SUCINTA DO PROFISSIONAL */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  <Quote size={12} />
                  <span>Sobre o Especialista</span>
                </div>
                <p className="text-xs text-slate-100 italic leading-relaxed line-clamp-3">
                  "{bioText}"
                </p>
              </div>

              {/* Especialidades / Tags */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-semibold bg-white/10 text-blue-100 px-2 py-0.5 rounded-md border border-white/5"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* QR Code & Contatos */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 flex items-center justify-between gap-3 pt-2">
                <div className="space-y-1.5 text-xs text-slate-200 min-w-0 flex-1">
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-emerald-400 shrink-0" />
                      <span className="font-medium truncate">{user.phone}</span>
                    </div>
                  )}
                  {user.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={13} className="text-blue-400 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">mestrio.com.br</p>
                </div>

                <div className="bg-white p-1.5 rounded-lg shadow-md shrink-0">
                  <img
                    src={qrCodeImageUrl}
                    alt="QR Code do Perfil"
                    className="w-16 h-16 rounded"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dica de Utilização */}
          <p className="text-xs text-center text-gray-500 leading-relaxed">
            Compartilhe seu cartão no WhatsApp de clientes ou baixe em alta resolução para publicar no Instagram e redes sociais.
          </p>
        </div>

        {/* OPÇÕES DE EXPORTAÇÃO E COMPARTILHAMENTO */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 space-y-2.5">
          {/* Linha Principal: WhatsApp & Copiar Link */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full sm:flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            >
              <MessageCircle size={15} />
              Enviar no WhatsApp
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full sm:flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? 'Link Copiado!' : 'Copiar Link do Perfil'}
            </button>
          </div>

          {/* Linha Secundária: Download JPEG & SVG */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDownloadJPEG}
              disabled={isExportingJPEG}
              className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <FileImage size={14} className="text-blue-600" />
              {isExportingJPEG ? 'Gerando JPEG...' : 'Baixar JPEG (Imagem)'}
            </button>

            <button
              type="button"
              onClick={handleDownloadSVG}
              disabled={isExportingSVG}
              className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Layers size={14} className="text-purple-600" />
              {isExportingSVG ? 'Gerando SVG...' : 'Baixar SVG (Vetor)'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

