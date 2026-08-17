
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { store, supabase, uploadImage } from '../services/store';
import { useToast } from '../context/ToastContext';
import { ChatSession, Message } from '../types';
import QuoteBuilder from '../components/QuoteBuilder';

const Chat: React.FC = () => {
  const { user, loading } = useAuth();
  const { id: routeChatId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
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

  // Initial load
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

    // Limite de 8MB
    if (file.size > 8 * 1024 * 1024) {
      toast('A foto deve ter no máximo 8MB.', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const publicUrl = await uploadImage(file, 'ad-images');
      if (publicUrl) {
        // Envia mensagem com tag de foto
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
    '🛠️ Pode fazer uma visita técnica para avaliar o serviço?',
    '📸 Enviei fotos do local para você avaliar.',
  ];

  const providerQuickReplies = [
    '✅ Olá! Posso te atender com certeza.',
    '📸 Poderia me enviar uma foto ou vídeo do problema/local?',
    '📍 Qual o seu bairro/endereço para eu calcular o deslocamento?',
    '📄 Vou preparar uma proposta comercial detalhada para você.',
    '🕒 Qual o melhor horário para eu realizar a visita?',
  ];

  const activeQuickReplies = isProviderInThisChat ? providerQuickReplies : clientQuickReplies;

  // Helper para renderizar conteúdo da mensagem (texto, imagem ou proposta)
  const renderMessageContent = (text: string) => {
    // 1. Mensagem com Foto ([IMG]url[/IMG])
    const imgMatch = text.match(/\[IMG\](.*?)\[\/IMG\]/);
    if (imgMatch) {
      const imageUrl = imgMatch[1];
      const remainingText = text.replace(/\[IMG\].*?\[\/IMG\]/, '').trim();
      return (
        <div className="space-y-2">
          <div 
            onClick={() => setLightboxImage(imageUrl)}
            className="cursor-pointer overflow-hidden rounded-xl border border-black/10 hover:opacity-95 transition group relative"
          >
            <img 
              src={imageUrl} 
              alt="Foto enviada no chat" 
              className="max-h-64 max-w-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
              <ExternalLink size={14} /> Ampliar
            </div>
          </div>
          {remainingText && <p className="text-sm whitespace-pre-wrap break-words">{remainingText}</p>}
        </div>
      );
    }

    // 2. Mensagem com Proposta Comercial / Orçamento
    if (text.includes('ORÇAMENTO DE PRESTAÇÃO DE SERVIÇOS') || text.includes('Proposta Comercial') || text.includes('VALOR TOTAL:')) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold pb-1 border-b border-current/20">
            <FileText size={14} /> Proposta Comercial
          </div>
          <p className="text-xs whitespace-pre-wrap break-words leading-relaxed font-mono bg-black/5 p-2 rounded-lg">
            {text}
          </p>
        </div>
      );
    }

    // 3. Mensagem de texto normal
    return <p className="text-sm whitespace-pre-wrap break-words">{text}</p>;
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-gray-100">
      
      {/* Sidebar List */}
      <div className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col ${activeChat && 'hidden md:flex'}`}>
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Mensagens</h2>
          <span className="text-xs font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-200">
            {chats.length} {chats.length === 1 ? 'conversa' : 'conversas'}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>Nenhuma conversa iniciada.</p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-100">
                    {chats.map(chat => (
                        <li 
                            key={chat.id}
                            onClick={() => handleChatSelect(chat.id)}
                            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${activeChat?.id === chat.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-gray-900 line-clamp-1 flex items-center">
                                    {chat.otherUserName || 'Usuário'}
                                    {chat.unreadCount ? (
                                        <span className="ml-2 w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" title={`${chat.unreadCount} nova(s) mensagem(ns)`}></span>
                                    ) : null}
                                </span>
                                <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                    {new Date(chat.updatedAt).toLocaleDateString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            <p className="text-xs text-brand-600 mb-1 font-medium">{chat.adTitle}</p>
                            <p className={`text-sm line-clamp-1 ${chat.unreadCount ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                                {chat.lastMessage?.includes('[IMG]') ? '📸 Foto compartilhada' : (chat.lastMessage || 'Nenhuma mensagem.')}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 flex flex-col bg-gray-50 ${!activeChat && 'hidden md:flex'}`}>
        {activeChat ? (
            <>
                {/* Chat Header com Botão de Criar Orçamento */}
                <div className="p-3.5 px-4 bg-white border-b border-gray-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                        <button onClick={() => navigate('/dashboard/chat')} className="mr-3 md:hidden text-gray-500 hover:text-gray-800">
                            <ArrowLeft />
                        </button>
                        <div className="flex items-center min-w-0">
                            {activeChat.providerName ? (
                                <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold mr-3 shrink-0 shadow-xs">
                                    {(activeChat.otherUserName || activeChat.providerName || 'P').charAt(0).toUpperCase()}
                                </div>
                            ) : null}
                            <div className="min-w-0">
                                <h3 className="font-bold text-gray-800 text-sm truncate flex items-center gap-1.5">
                                    <span>{activeChat.otherUserName || activeChat.providerName || 'Conversa'}</span>
                                    <span className="text-xs font-normal text-gray-400">({activeChat.adTitle})</span>
                                </h3>
                                <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                    Chat Ativo no Mestrio
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Botão de Criar Orçamento no Topo */}
                    <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowQuoteModal(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition shadow-xs shrink-0"
                          title="Criar proposta comercial e enviar ao cliente"
                        >
                          <Calculator size={15} />
                          <span className="hidden sm:inline">Criar Orçamento</span>
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeChat.messages.length === 0 && (
                        <div className="text-center text-gray-400 mt-10 text-sm">
                            <p>Comece a conversa com o prestador.</p>
                            <p>Envie dúvidas ou fotos do serviço anunciado.</p>
                        </div>
                    )}
                    
                    {groupedMessages(activeChat.messages).map(group => (
                        <div key={group.label}>
                            <div className="flex justify-center mb-4">
                                <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full font-medium">
                                    {group.label}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {group.messages.map((msg) => {
                                    const isMe = msg.senderId === user.id;
                                    const showAvatar = !isMe;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end`}>
                                            {showAvatar && (
                                                <div className="w-7 h-7 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0">
                                                    {(activeChat.otherUserName || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className={`
                                                max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-xs
                                                ${isMe ? 'bg-brand-600 text-white rounded-br-xs' : 'bg-white text-gray-800 border border-gray-200/80 rounded-bl-xs'}
                                            `}>
                                                {renderMessageContent(msg.text)}
                                                <span className={`text-[10px] flex items-center justify-end mt-1.5 gap-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
                                                    {formatTime(msg.timestamp)}
                                                    {isMe && (
                                                        msg.read
                                                            ? <CheckCheck size={13} className="text-brand-200" />
                                                            : <Check size={13} className="text-brand-200/70" />
                                                    )}
                                                </span>
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
                <div className="bg-white border-t border-gray-100 px-4 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-500" /> Respostas Rápidas:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickReplies(prev => !prev)}
                      className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
                    >
                      {showQuickReplies ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                  </div>

                  {showQuickReplies && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {activeQuickReplies.map((reply, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(reply)}
                          className="px-3 py-1 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-700 rounded-full text-xs whitespace-nowrap transition border border-slate-200 shadow-2xs shrink-0"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input Area com Envio de Fotos */}
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 bg-white border-t border-gray-200">
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
                          className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
                          title="Enviar foto do local ou serviço"
                        >
                          {uploadingImage ? <Loader2 size={20} className="animate-spin text-brand-600" /> : <ImageIcon size={20} />}
                        </button>

                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={uploadingImage ? 'Enviando foto...' : 'Digite sua mensagem...'}
                            disabled={uploadingImage}
                            className="flex-1 border-gray-300 rounded-full focus:ring-2 focus:ring-brand-500 focus:border-brand-500 px-4 py-2 text-sm border shadow-2xs outline-none"
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim() || sending || uploadingImage}
                            className="bg-brand-600 text-white p-2.5 rounded-full hover:bg-brand-700 disabled:opacity-50 transition shadow-xs"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <UserIcon size={32} />
                </div>
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Ou inicie um chat através de um anúncio</p>
            </div>
        )}
      </div>

      {/* Modal de Criar Orçamento Direto no Chat */}
      {showQuoteModal && activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden border border-gray-200">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn cursor-pointer"
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
