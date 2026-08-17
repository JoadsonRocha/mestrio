
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Send, 
  User as UserIcon, 
  ArrowLeft, 
  CheckCheck, 
  Check, 
  Image as ImageIcon, 
  Camera, 
  Calculator, 
  Sparkles, 
  X, 
  Loader2, 
  FileText, 
  Download, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Tag,
  ShieldCheck,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { store, supabase, uploadImage } from '../services/store';
import { useToast } from '../context/ToastContext';
import { ChatSession, Message, ServiceAd } from '../types';
import { QuoteBuilder } from '../components/QuoteBuilder';
import { VerifiedBadge } from '../components/VerifiedBadge';

const Chat: React.FC = () => {
  const { user, loading } = useAuth();
  const { id: routeChatId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [activeAd, setActiveAd] = useState<ServiceAd | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const activeChatRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Initial load de chats
  useEffect(() => {
    if (loading) return;
    if (!user) {
        navigate('/login');
        return;
    }

    const loadChats = async () => {
        const userChats = await store.getChats(user.id);
        setChats(userChats);

        if (routeChatId) {
            const found = await store.getChatById(routeChatId, user.id);
            if (found) {
                if (found.unreadCount && found.unreadCount > 0) {
                    await store.markMessagesAsRead(found.id, user.id);
                    const refreshed = await store.getChatById(routeChatId, user.id);
                    if (refreshed) {
                        setActiveChat(refreshed);
                        setChats(prev => prev.map(c => c.id === refreshed.id ? refreshed : c));
                    }
                } else {
                    setActiveChat(found);
                }
            }
        } else if (userChats.length > 0 && window.innerWidth >= 768) {
            navigate(`/dashboard/chat/${userChats[0].id}`);
        }
    };
    loadChats();
  }, [user, routeChatId, navigate]);

  // Carrega os detalhes do anúncio ativo para o mini-card do header
  useEffect(() => {
    if (!activeChat?.adId) {
      setActiveAd(null);
      return;
    }

    const loadAdDetails = async () => {
      try {
        const ad = await store.getAdById(activeChat.adId);
        setActiveAd(ad);
      } catch {
        setActiveAd(null);
      }
    };
    loadAdDetails();
  }, [activeChat?.adId]);

  // Realtime: recebe novas mensagens em tempo real
  useEffect(() => {
    if (!user || !activeChat?.id) return;

    const channel = supabase
      .channel(`chat-${activeChat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `session_id=eq.${activeChat.id}`
      }, async (payload: any) => {
        const msg = payload.new;
        if (msg.sender_id === user.id) return;

        await store.markMessagesAsRead(activeChat.id, user.id);
        const updated = await store.getChatById(activeChat.id, user.id);
        if (updated) {
          setActiveChat(updated);
          setChats(prev => prev.map(c => c.id === updated.id ? updated : c)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeChat?.id]);

  // Realtime: atualiza lista de chats quando chega mensagem em outra conversa
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chats-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, async () => {
        if (activeChatRef.current) return;
        const userChats = await store.getChats(user.id);
        setChats(userChats);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : newMessage).trim();
    if (!text || !activeChat || !user) return;

    if (textToSend === undefined) setNewMessage('');
    setSending(true);

    // Optimistic UI update
    const optimisticMessage: Message = {
      id: 'temp-' + Date.now(),
      text: text,
      senderId: user.id,
      timestamp: new Date().toISOString(),
      read: false
    };

    setActiveChat(prev => prev ? {
      ...prev,
      messages: [...prev.messages, optimisticMessage]
    } : prev);

    try {
      await store.sendMessage(activeChat.id, user.id, text);
      const updatedChat = await store.getChatById(activeChat.id, user.id);
      if (updatedChat) {
          setActiveChat({ ...updatedChat });
          setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast('Não foi possível enviar a mensagem. Verifique a conexão.', 'error');
      // Rollback optimistic update
      const rollbackChat = await store.getChatById(activeChat.id, user.id);
      if (rollbackChat) setActiveChat(rollbackChat);
    } finally {
      setSending(false);
    }
  };

  // Upload e envio de fotos no chat
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !user) return;

    if (file.size > 8 * 1024 * 1024) {
      toast('A foto deve ter no máximo 8MB.', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const publicUrl = await uploadImage(file, 'ad-images');
      if (publicUrl) {
        const photoMessage = `[IMG]${publicUrl}[/IMG]`;
        await handleSendMessage(photoMessage);
        toast('Foto enviada com sucesso!', 'success');
      }
    } catch (err) {
      console.error('Erro ao enviar imagem no chat:', err);
      toast('Falha ao enviar foto. Tente novamente.', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChatSelect = (chatId: string) => {
      navigate(`/dashboard/chat/${chatId}`);
  };

  // Formata a hora e o dia da mensagem
  const formatTime = (ts: string) =>
      new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDayLabel = (ts: string) => {
      const d = new Date(ts);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return 'Hoje';
      if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!user) return null;

  // Filtra conversas por busca
  const filteredChats = chats.filter(chat => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const otherName = (chat.otherUserName || chat.providerName || chat.clientName || '').toLowerCase();
    const adTitle = (chat.adTitle || '').toLowerCase();
    const lastMsg = (chat.lastMessage || '').toLowerCase();
    return otherName.includes(term) || adTitle.includes(term) || lastMsg.includes(term);
  });

  // Separa as mensagens por dia para exibir marcadores de data
  const groupedMessages = (msgs: Message[]) => {
      const groups: { label: string; messages: Message[] }[] = [];
      for (const msg of msgs) {
          const label = formatDayLabel(msg.timestamp);
          const last = groups[groups.length - 1];
          if (last && last.label === label) {
              last.messages.push(msg);
          } else {
              groups.push({ label, messages: [msg] });
          }
      }
      return groups;
  };

  // Identifica se o usuário logado é o prestador ou cliente
  const isProviderInThisChat = activeChat?.providerName && user?.name === activeChat?.providerName;

  // Respostas Rápidas (Quick Replies)
  const clientQuickReplies = [
    '💬 Olá! Gostaria de solicitar um orçamento.',
    '📅 Qual sua disponibilidade para esta semana?',
    '📍 Você atende na minha região / bairro?',
    '🛠️ Pode fazer uma visita técnica para avaliar?',
    '📸 Enviei fotos do local para você avaliar.',
  ];

  const providerQuickReplies = [
    '✅ Olá! Posso te atender com certeza.',
    '📸 Poderia me enviar fotos do problema/local?',
    '📍 Qual o seu bairro/endereço para eu calcular o deslocamento?',
    '📄 Vou preparar uma proposta comercial detalhada para você.',
    '🕒 Qual o melhor horário para eu realizar a visita?',
  ];

  const activeQuickReplies = isProviderInThisChat ? providerQuickReplies : clientQuickReplies;

  // Helper para renderizar conteúdo da mensagem (texto, imagem ou proposta)
  const renderMessageContent = (text: string, isMe: boolean) => {
    // 1. Mensagem com Foto ([IMG]url[/IMG])
    const imgMatch = text.match(/\[IMG\](.*?)\[\/IMG\]/);
    if (imgMatch) {
      const imageUrl = imgMatch[1];
      const remainingText = text.replace(/\[IMG\].*?\[\/IMG\]/, '').trim();
      return (
        <div className="space-y-2">
          <div 
            onClick={() => setLightboxImage(imageUrl)}
            className="cursor-pointer overflow-hidden rounded-xl border border-black/10 hover:opacity-95 transition group relative bg-black/5"
          >
            <img 
              src={imageUrl} 
              alt="Foto enviada no chat" 
              className="max-h-72 max-w-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-2xs">
              <ExternalLink size={15} /> Clique para Ampliar
            </div>
          </div>
          {remainingText && <p className="text-sm whitespace-pre-wrap break-words">{remainingText}</p>}
        </div>
      );
    }

    // 2. Mensagem com Proposta Comercial / Orçamento
    if (text.includes('ORÇAMENTO DE PRESTAÇÃO DE SERVIÇOS') || text.includes('Proposta Comercial') || text.includes('VALOR TOTAL:')) {
      return (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-current/20">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <FileText size={15} className={isMe ? 'text-blue-200' : 'text-emerald-600'} /> Proposta Comercial
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Oficial
            </span>
          </div>
          <div className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap break-words font-mono ${
            isMe ? 'bg-blue-900/40 text-blue-50 border border-blue-500/30' : 'bg-slate-50 text-slate-800 border border-slate-200'
          }`}>
            {text}
          </div>
        </div>
      );
    }

    // 3. Mensagem de texto normal
    return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{text}</p>;
  };

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-slate-100 rounded-2xl border border-slate-200/80 shadow-2xs">
      
      {/* Sidebar List (Lista de Usuários / Conversas) */}
      <div className={`w-full sm:w-80 md:w-80 lg:w-80 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full ${activeChat ? 'hidden sm:flex' : 'flex'}`}>
        
        {/* Header da Sidebar com Busca */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Mensagens
              <span className="text-xs font-bold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-200">
                {chats.length}
              </span>
            </h2>
          </div>

          {/* Input de Busca */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, serviço ou texto..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition shadow-2xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        {/* Lista de Conversas com Avatares e Badges */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                    <UserIcon size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">
                      {searchTerm ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa iniciada.'}
                    </p>
                    <p className="text-xs">
                      {searchTerm ? 'Tente buscar por outro termo.' : 'Inicie um chat através da página de anúncios.'}
                    </p>
                </div>
            ) : (
                <ul>
                    {filteredChats.map(chat => {
                      const isSelected = activeChat?.id === chat.id;
                      const displayName = chat.otherUserName || chat.providerName || chat.clientName || 'Usuário';
                      const initial = displayName.charAt(0).toUpperCase();
                      const hasUnread = Boolean(chat.unreadCount && chat.unreadCount > 0);

                      return (
                        <li 
                            key={chat.id}
                            onClick={() => handleChatSelect(chat.id)}
                            className={`p-3.5 px-4 hover:bg-slate-50 cursor-pointer transition-all border-l-4 ${
                              isSelected ? 'bg-brand-50/70 border-brand-600 shadow-2xs' : 'border-transparent'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    {chat.otherUserAvatar ? (
                                        <img 
                                            src={chat.otherUserAvatar} 
                                            alt={displayName} 
                                            className="w-11 h-11 rounded-full object-cover shadow-xs border border-slate-200" 
                                        />
                                    ) : (
                                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                                            {initial}
                                        </div>
                                    )}
                                    {hasUnread && (
                                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse"></span>
                                    )}
                                </div>

                                {/* Dados da Conversa */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <span className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                            {displayName}
                                        </span>
                                        <span className="text-[11px] text-slate-400 whitespace-nowrap ml-2">
                                            {new Date(chat.updatedAt).toLocaleDateString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>

                                    <p className="text-[11px] text-brand-600 font-semibold truncate mb-0.5">
                                        {chat.adTitle}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <p className={`text-xs truncate ${hasUnread ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                            {chat.lastMessage?.includes('[IMG]') ? '📸 Foto compartilhada' : (chat.lastMessage || 'Nenhuma mensagem.')}
                                        </p>
                                        {hasUnread && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full shrink-0">
                                                {chat.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </li>
                      );
                    })}
                </ul>
            )}
        </div>
      </div>

      {/* Chat Window (Área da Conversa) */}
      <div className={`flex-1 flex flex-col bg-slate-100 min-w-0 h-full ${!activeChat ? 'hidden sm:flex' : 'flex'}`}>
        {activeChat ? (
            <>
                {/* Header Superior com Mini-Card do Anúncio e Ações */}
                <div className="bg-white border-b border-slate-200 shadow-xs">
                  {/* Linha 1: Dados do Usuário e Botões Principais */}
                  <div className="p-3 px-4 flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                        <button 
                          onClick={() => navigate('/dashboard/chat')} 
                          className="mr-3 md:hidden text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100"
                          title="Voltar para lista de conversas"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div className="flex items-center min-w-0 gap-3">
                            {activeChat.otherUserAvatar ? (
                                <img 
                                  src={activeChat.otherUserAvatar} 
                                  alt={activeChat.otherUserName || activeChat.providerName || 'Contato'} 
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs" 
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                    {(activeChat.otherUserName || activeChat.providerName || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                                    <span>{activeChat.otherUserName || activeChat.providerName || 'Contato'}</span>
                                </h3>
                                <p className="text-[11px] text-emerald-600 font-semibold truncate flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                                    Ativo no Mestrio
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Botões de Ação do Header */}
                    <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowQuoteModal(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition shadow-xs shrink-0"
                          title="Criar proposta comercial executiva e enviar ao cliente"
                        >
                          <Calculator size={15} />
                          <span className="hidden sm:inline">Criar Orçamento</span>
                        </button>
                    </div>
                  </div>

                  {/* Linha 2: Mini-Card de Identificação do Anúncio / Contexto */}
                  <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {activeAd?.images?.[0] || activeAd?.photos?.[0] ? (
                        <img 
                          src={activeAd?.images?.[0] || activeAd?.photos?.[0]} 
                          alt={activeChat.adTitle} 
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                          <Tag size={14} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate leading-tight">
                          {activeChat.adTitle}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {activeAd?.price ? `R$ ${activeAd.price} • ${activeAd.location || 'Atendimento local'}` : 'Serviço sob orçamento'}
                        </p>
                      </div>
                    </div>

                    <Link 
                      to={`/servico/${activeChat.adId}`}
                      target="_blank"
                      className="text-brand-600 hover:text-brand-700 font-bold text-xs whitespace-nowrap hover:underline flex items-center gap-1 shrink-0"
                    >
                      Ver Anúncio →
                    </Link>
                  </div>
                </div>

                {/* Messages Area (Área de Mensagens com Balões Modernos) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeChat.messages.length === 0 && (
                        <div className="text-center text-slate-400 mt-12 space-y-2">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-xs border border-slate-200 mx-auto flex items-center justify-center text-brand-600">
                              <Sparkles size={24} />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Inicie a conversa!</p>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                              Tire dúvidas sobre o serviço anunciado, envie fotos do local ou solicite uma proposta.
                            </p>
                        </div>
                    )}
                    
                    {groupedMessages(activeChat.messages).map(group => (
                        <div key={group.label}>
                            <div className="flex justify-center my-3">
                                <span className="text-[11px] bg-slate-200/80 text-slate-700 px-3 py-0.5 rounded-full font-semibold shadow-2xs">
                                    {group.label}
                                </span>
                            </div>
                            <div className="space-y-2.5">
                                {group.messages.map((msg) => {
                                    const isMe = msg.senderId === user.id;
                                    const showAvatar = !isMe;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end group`}>
                                            {showAvatar && (
                                                activeChat.otherUserAvatar ? (
                                                  <img 
                                                    src={activeChat.otherUserAvatar} 
                                                    alt={activeChat.otherUserName || 'U'} 
                                                    className="w-7 h-7 rounded-full object-cover mr-2 shrink-0 border border-slate-200 shadow-2xs" 
                                                  />
                                                ) : (
                                                  <div className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 shadow-2xs">
                                                      {(activeChat.otherUserName || 'U').charAt(0).toUpperCase()}
                                                  </div>
                                                )
                                            )}
                                            <div className={`
                                                max-w-[85%] md:max-w-[70%] rounded-2xl p-3 shadow-xs transition-shadow
                                                ${isMe 
                                                  ? 'bg-blue-600 text-white rounded-br-2xs' 
                                                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-2xs'
                                                }
                                            `}>
                                                {renderMessageContent(msg.text, isMe)}
                                                <div className={`text-[10px] flex items-center justify-end mt-1.5 gap-1 ${
                                                  isMe ? 'text-blue-100' : 'text-slate-400'
                                                }`}>
                                                    <span>{formatTime(msg.timestamp)}</span>
                                                    {isMe && (
                                                        msg.read
                                                            ? <CheckCheck size={14} className="text-sky-200" title="Mensagem lida" />
                                                            : <Check size={14} className="text-blue-200/80" title="Mensagem enviada" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Respostas Rápidas (Quick Replies) */}
                <div className="bg-white border-t border-slate-100 px-4 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-500" /> Respostas Rápidas:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickReplies(prev => !prev)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                    >
                      {showQuickReplies ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                  </div>

                  {showQuickReplies && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {activeQuickReplies.map((reply, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(reply)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-700 rounded-full text-xs whitespace-nowrap transition border border-slate-200 shadow-2xs shrink-0 font-medium active:scale-95"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Barra de Digitação Ergonômica */}
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3.5 bg-white border-t border-slate-200">
                    <div className="flex items-center space-x-2">
                        {/* Botão de Envio de Fotos */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingImage || sending}
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-full transition disabled:opacity-50 border border-slate-200/60 shadow-2xs"
                          title="Enviar foto do local ou serviço"
                        >
                          {uploadingImage ? <Loader2 size={19} className="animate-spin text-brand-600" /> : <ImageIcon size={19} />}
                        </button>

                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={uploadingImage ? 'Enviando foto...' : 'Digite sua mensagem...'}
                            disabled={uploadingImage}
                            className="flex-1 border-slate-300 rounded-full focus:ring-2 focus:ring-brand-500 focus:border-transparent px-4 py-2.5 text-sm border shadow-2xs outline-none bg-slate-50 focus:bg-white transition"
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim() || sending || uploadingImage}
                            className="bg-blue-600 text-white p-2.5 px-3.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition shadow-sm active:scale-95 flex items-center justify-center"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-xs text-brand-600">
                    <UserIcon size={32} />
                </div>
                <p className="text-base font-bold text-slate-700">Selecione uma conversa ao lado</p>
                <p className="text-xs text-slate-500 max-w-sm text-center">
                  Aqui você conversa diretamente com clientes e prestadores para tirar dúvidas, enviar fotos e combinar orçamentos.
                </p>
            </div>
        )}
      </div>

      {/* Modal de Criar Orçamento Direto no Chat */}
      {showQuoteModal && activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="text-emerald-400" size={20} />
                <div>
                  <h3 className="font-bold text-sm text-white">Criar Orçamento para {activeChat.otherUserName || 'Cliente'}</h3>
                  <p className="text-[11px] text-slate-400">Serviço: {activeChat.adTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuoteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <QuoteBuilder />
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para Visualizar Fotos em Tela Cheia */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xs animate-fadeIn cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black text-white p-2 rounded-full transition"
            >
              <X size={20} />
            </button>
            <img 
              src={lightboxImage} 
              alt="Foto expandida" 
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
