
import { createClient } from '@supabase/supabase-js';
import { ServiceAd, User, UserRole, ChatSession, Message, Review, Category, AdminStats, AdStatus, JobRequest, QuoteProposal, ProfessionalSchedule, AuditLogItem, SystemBroadcast } from '../types';

import { DEFAULT_CATEGORIES } from '../constants';
import { sanitizeText, sanitizeHtmlLike, sanitizePhone } from '../utils/sanitization';

export interface GetAdsParams {
  category?: string;
  searchTerm?: string;
  location?: string;
  providerId?: string;
  priceRange?: string;
  isPremium?: boolean;
  page?: number;
  limit?: number;
}

/**
 * GUIA DE CONFIGURAÇÃO SQL PARA O SUPABASE:
 * Execute o arquivo `schema.sql` (raiz do projeto) no SQL Editor do Supabase.
 * Ele cria as tabelas, políticas RLS (cada usuário só altera o que é dele),
 * o modelo de dono/admin (RPCs SECURITY DEFINER), habilita o Realtime para
 * mensagens e agendamentos e desbloqueia o módulo de moderação.
 * Após criar o usuário admin, execute UMA vez:
 *   UPDATE profiles SET role = 'ADMIN', is_owner = true
 *   WHERE id = 'SEU_AUTH_UID';
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tdbtkmtjtkidfesgalgk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AD_IMAGES_BUCKET = import.meta.env.VITE_AD_IMAGES_BUCKET || 'ad-images';
const AVATARS_BUCKET = import.meta.env.VITE_AVATARS_BUCKET || 'avatars';

/** Envia um arquivo para o Supabase Storage e retorna a URL pública. */
const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

export async function uploadImage(file: File, bucket: string = AD_IMAGES_BUCKET): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';

  // Rejeita SVG e qualquer formato não-imagem (prevenção de stored XSS).
  if (!ALLOWED_IMAGE_EXT.includes(ext)) {
    throw new Error('Formato de imagem não suportado. Use JPG, PNG, WEBP, GIF ou AVIF.');
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('O arquivo precisa ser uma imagem.');
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export { AD_IMAGES_BUCKET, AVATARS_BUCKET };

class Store {
  private mapAd(data: any): ServiceAd {
    return {
      id: data.id,
      providerId: data.provider_id,
      providerName: sanitizeText(data.profiles?.name || 'Profissional'),
      title: sanitizeText(data.title),
      description: sanitizeHtmlLike(data.description),
      category: data.category,
      price: data.price,
      priceUnit: data.price_unit,
      location: sanitizeText(data.location),
      images: data.images || [],
      rating: data.rating || 0,
      reviewCount: data.review_count || 0,
      reviews: (data.reviews || []).map((r: any) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: r.author_name,
        rating: r.rating,
        comment: r.comment,
        date: r.created_at
      })),
      isPremium: data.is_premium,
      createdAt: data.created_at,
      whatsapp: sanitizePhone(data.whatsapp || ''),
      availability: data.availability,
      tags: (data.tags || []).map((tag: string) => sanitizeText(tag)),
      providerAvatar: data.profiles?.avatar || undefined,
      isCertified: data.profiles?.is_certified || false,
      status: data.status || 'approved',
      expiresAt: data.expires_at,
      rejectionReason: data.rejection_reason,
      views: data.views || 0
    };
  }

  private mapCategory(data: any): Category {
    return {
      id: data.id,
      slug: data.slug,
      name: sanitizeText(data.name),
      icon: data.icon || 'Wrench',
      sortOrder: data.sort_order || 0,
      active: data.active !== false
    };
  }

  async getAds(params?: GetAdsParams): Promise<ServiceAd[]> {
    let query = supabase.from('service_ads').select('*, profiles(name, avatar, is_certified)');

    // Sem providerId = consulta pública: apenas anúncios aprovados e não expirados.
    const isPublic = !params?.providerId;
    if (params?.category && params.category !== 'all') {
      query = query.eq('category', params.category);
    }
    if (params?.providerId) {
      query = query.eq('provider_id', params.providerId);
    } else {
      query = query.eq('status', 'approved');
    }
    if (params?.location) {
      query = query.ilike('location', `%${params.location}%`);
    }
    if (params?.isPremium !== undefined) {
      query = query.eq('is_premium', params.isPremium);
    }
    if (params?.priceRange && params.priceRange !== 'all') {
        if (params.priceRange === 'low') query = query.lte('price', 100).gt('price', 0);
        if (params.priceRange === 'mid') query = query.gt('price', 100).lte('price', 300);
        if (params.priceRange === 'high') query = query.gt('price', 300);
        if (params.priceRange === 'estimate') query = query.eq('price', 0);
    }

    const nowIso = new Date().toISOString();
    if (params?.searchTerm) {
      // Combina busca (título OU descrição) com não-expirado em um único `or`
      const s = params.searchTerm;
      const clauses: string[] = [];
      for (const col of ['title', 'description']) {
        clauses.push(`and(${col}.ilike.%${s}%,expires_at.is.null)`);
        clauses.push(`and(${col}.ilike.%${s}%,expires_at.gt.${nowIso})`);
      }
      query = query.or(clauses.join(','));
    } else if (isPublic) {
      query = query.or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    }

    const limit = params?.limit || 50;
    const page = params?.page || 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, error } = await query;
    
    if (error) { console.error("Store Error [getAds]:", error); throw error; }
    return (data || []).map(ad => this.mapAd(ad));
  }

  async getAdById(id: string): Promise<ServiceAd | null> {
    const { data, error } = await supabase
      .from('service_ads')
      .select('*, profiles(name, avatar, is_certified), reviews(*)')
      .eq('id', id)
      .single();
    
    if (error || !data) { console.error("Store Error [getAdById]:", error); return null; }
    return this.mapAd(data);
  }

  /** Incrementa o contador de visualizações do anúncio — RPC pública. */
  async incrementAdView(adId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_ad_view', { ad_id: adId });
    if (error) { console.error("Store Error [incrementAdView]:", error); }
  }

  async addAd(ad: Omit<ServiceAd, 'id' | 'createdAt' | 'rating' | 'reviewCount' | 'reviews' | 'providerName'>): Promise<ServiceAd> {
    const durationDays = await this.getAdDurationDays();
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('service_ads')
      .insert([{
        provider_id: ad.providerId,
        title: ad.title,
        description: ad.description,
        category: ad.category,
        price: ad.price,
        price_unit: ad.priceUnit,
        location: ad.location,
        images: ad.images,
        whatsapp: ad.whatsapp,
        availability: ad.availability,
        tags: ad.tags || [],
        is_premium: ad.isPremium || false,
        status: 'pending',
        expires_at: expiresAt
      }])
      .select()
      .single();
    
    if (error) { console.error("Store Error [addAd]:", error); throw error; }
    return this.mapAd(data);
  }

  async updateAd(id: string, ad: Partial<ServiceAd>): Promise<void> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (ad.title !== undefined) updateData.title = ad.title;
    if (ad.description !== undefined) updateData.description = ad.description;
    if (ad.category !== undefined) updateData.category = ad.category;
    if (ad.price !== undefined) updateData.price = ad.price;
    if (ad.priceUnit !== undefined) updateData.price_unit = ad.priceUnit;
    if (ad.location !== undefined) updateData.location = ad.location;
    if (ad.whatsapp !== undefined) updateData.whatsapp = ad.whatsapp;
    if (ad.images !== undefined) updateData.images = ad.images;
    if (ad.availability !== undefined) updateData.availability = ad.availability;
    if (ad.tags !== undefined) updateData.tags = ad.tags;

    const { error } = await supabase
      .from('service_ads')
      .update(updateData)
      .eq('id', id);
      
    if (error) { console.error("Store Error [updateAd]:", error); throw error; }
  }

  async addReview(adId: string, review: Omit<Review, 'id' | 'date'>): Promise<void> {
    const { error: reviewError } = await supabase
      .from('reviews')
      .insert([{
        ad_id: adId,
        author_id: review.authorId,
        author_name: review.authorName,
        rating: review.rating,
        comment: review.comment
      }]);
    
    if (reviewError) { console.error("Store Error [addReview]:", reviewError); throw reviewError; }

    // Recálculo de nota/count via RPC SECURITY DEFINER (o provider não pode
    // mais manipular rating/review_count direto por REST).
    const { error: updateError } = await supabase.rpc('recalculate_ad_rating', { ad_id: adId });
    if (updateError) console.warn("Could not update service rating:", updateError);
  }

  async deleteAd(id: string): Promise<void> {
    const { error } = await supabase.from('service_ads').delete().eq('id', id);
    if (error) { console.error("Store Error [deleteAd]:", error); throw error; }
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !data) return null;
    if (data.is_suspended) return null;

    let permissions: string[] | undefined;
    if (data.is_owner || data.role === 'ADMIN') {
      const { data: perms } = await supabase.rpc('get_my_permissions');
      permissions = Array.isArray(perms) ? perms : [];
    }

    // PII em canal privado: email vem da sessão (auth.users), telefone de user_private.
    const { data: privateData } = await supabase
      .from('user_private')
      .select('phone')
      .eq('user_id', session.user.id)
      .maybeSingle();

    return {
      id: data.id,
      name: data.name,
      email: session.user.email || '',
      role: data.role as UserRole,
      avatar: data.avatar,
      location: data.location,
      phone: privateData?.phone || '',
      bio: data.bio,
      isCertified: data.is_certified || false,
      isSuspended: false,
      isOwner: data.is_owner || false,
      roleRequest: data.role_request || null,
      permissions,
      createdAt: data.created_at
    };
  }

  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, name, avatar, bio, location, role, is_certified')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      role: data.role as UserRole,
      avatar: data.avatar,
      location: data.location,
      bio: data.bio,
      isCertified: data.is_certified || false,
      email: '', // omitted for privacy in public profile
      phone: ''  // omitted for privacy unless needed (we can fetch later if required)
    };
  }

  private normalizeUserInput(value: string): string {
    return sanitizeText(value);
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const profileData: any = {};
    if (updates.name !== undefined) profileData.name = this.normalizeUserInput(updates.name);
    if (updates.bio !== undefined) profileData.bio = sanitizeHtmlLike(updates.bio);
    if (updates.location !== undefined) profileData.location = this.normalizeUserInput(updates.location);
    if (updates.avatar !== undefined) profileData.avatar = updates.avatar;

    const { error } = await supabase.from('profiles').update(profileData).eq('id', userId);
    if (error) { console.error("Store Error [updateProfile]:", error); throw error; }

    // Telefone mora em user_private (PII não fica exposta em profiles).
    if (updates.phone !== undefined) {
      const { error: phoneError } = await supabase
        .from('user_private')
        .upsert({ user_id: userId, phone: sanitizePhone(updates.phone || '') }, { onConflict: 'user_id' });
      if (phoneError) { console.error("Store Error [updateProfile] phone:", phoneError); throw phoneError; }
    }

    const updated = await this.getCurrentUser();
    if (!updated) throw new Error("Perfil não encontrado.");
    return updated;
  }

  async login(email: string, password?: string): Promise<User> {
    if (!password) throw new Error("Senha é obrigatória");
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (authError) throw authError;

    const userProfile = await this.getCurrentUser();
    if (!userProfile) {
      // getCurrentUser retorna null se o perfil não existe ou está suspenso
      throw new Error("Perfil não encontrado ou conta suspensa. Fale com o suporte.");
    }
    return userProfile;
  }

  async register(email: string, password: string, name: string, role?: UserRole): Promise<void> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });
    if (authError) throw authError;

    if (authData.user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                name: name,
                // Novo profissional entra como CLIENT com solicitação pendente,
                // até o dono aprovar (role_request = 'PROVIDER').
                role: role === UserRole.PROVIDER ? UserRole.CLIENT : (role || UserRole.PROVIDER),
                ...(role === UserRole.PROVIDER ? { role_request: 'PROVIDER' } : {}),
                avatar: `https://picsum.photos/seed/${email}/100/100`
            }]);
        if (profileError) console.error("Error creating profile", profileError);
    }
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) { console.error("Store Error [requestPasswordReset]:", error); throw error; }
  }

  async getChats(userId: string): Promise<ChatSession[]> {
    const { data: participantData } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('user_id', userId);
        
    if (!participantData || participantData.length === 0) return [];
    const sessionIds = participantData.map(p => p.session_id);
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        service_ads(title, provider_id),
        chat_participants(user_id, profiles(name, avatar)),
        messages(*)
      `)
      .in('id', sessionIds)
      .order('updated_at', { ascending: false });
    
    if (error) { console.error("Store Error [getChats]:", error); throw error; }
    
    return (data || []).map((c: any) => {
      const messages = (c.messages || []).map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        text: m.text,
        read: m.read,
        timestamp: m.created_at
      })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const unreadCount = messages.filter((m: any) => !m.read && m.senderId !== userId).length;

      // Find the other participant's name
      const otherParticipant = (c.chat_participants || []).find((p: any) => p.user_id !== userId);
      const otherUserName = otherParticipant?.profiles?.name;
      const otherUserAvatar = otherParticipant?.profiles?.avatar;

      const providerId = c.service_ads?.provider_id;
      const providerName = (c.chat_participants || []).find((p: any) => p.user_id === providerId)?.profiles?.name;
      const clientName = (c.chat_participants || []).find((p: any) => p.user_id !== providerId)?.profiles?.name;

      return {
        id: c.id,
        adId: c.ad_id,
        adTitle: c.service_ads?.title || 'Anúncio',
        participants: (c.chat_participants || []).map((p: any) => p.user_id),
        otherUserName: otherUserName,
        otherUserAvatar: otherUserAvatar,
        providerName,
        clientName,
        lastMessage: c.last_message,
        updatedAt: c.updated_at,
        unreadCount,
        messages
      };
    });
  }

  async getChatById(id: string, userId: string): Promise<ChatSession | null> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        service_ads(title, provider_id),
        chat_participants(user_id, profiles(name, avatar)),
        messages(*)
      `)
      .eq('id', id)
      .maybeSingle();
    
     if (error || !data) {
        if (error) console.error("Store Error [getChatById]:", error);
        return null;
    }

    const messages = (data.messages || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      text: m.text,
      read: m.read,
      timestamp: m.created_at
    })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const unreadCount = messages.filter((m: any) => !m.read && m.senderId !== userId).length;

    // Find the other participant's name
    const otherParticipant = (data.chat_participants || []).find((p: any) => p.user_id !== userId);
    const otherUserName = otherParticipant?.profiles?.name;

    const providerId = data.service_ads?.provider_id;
    const providerName = (data.chat_participants || []).find((p: any) => p.user_id === providerId)?.profiles?.name;
    const clientName = (data.chat_participants || []).find((p: any) => p.user_id !== providerId)?.profiles?.name;

    return {
      id: data.id,
      adId: data.ad_id,
      adTitle: data.service_ads?.title || 'Anúncio',
      participants: (data.chat_participants || []).map((p: any) => p.user_id),
      otherUserName: otherUserName,
      providerName,
      clientName,
      lastMessage: data.last_message,
      updatedAt: data.updated_at,
      unreadCount,
      messages
    };
  }

  async markMessagesAsRead(sessionId: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('session_id', sessionId)
        .neq('sender_id', userId)
        .eq('read', false);
    
    if (error) console.error("Store Error [markMessagesAsRead]:", error);
  }

  async getGlobalUnreadCount(userId: string): Promise<number> {
    const { data: participantData } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('user_id', userId);
        
    if (!participantData || participantData.length === 0) return 0;
    const sessionIds = participantData.map(p => p.session_id);

    const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .neq('sender_id', userId)
        .eq('read', false);

    if (error) { console.error("Store Error [getGlobalUnreadCount]:", error); return 0; }
    return count || 0;
  }

  // Cria/reusa a sessão de chat via RPC start_chat (SECURITY DEFINER):
  // valida autenticação, anúncio existente e insere os dois participantes.
  async startChat(clientId: string, providerId: string, adId: string, adTitle: string): Promise<string> {
    const { data, error } = await supabase.rpc('start_chat', { p_ad_id: adId });
    if (error) { console.error("Store Error [startChat]:", error); throw error; }
    return data as string;
  }

  async sendMessage(chatId: string, senderId: string, text: string): Promise<void> {
    const { error: msgError } = await supabase.from('messages').insert([{
      session_id: chatId,
      sender_id: senderId,
      text: text
    }]);

    if (msgError) { console.error("Store Error [sendMessage]:", msgError); throw msgError; }

    await supabase.from('chat_sessions').update({
      last_message: text,
      updated_at: new Date().toISOString()
    }).eq('id', chatId);
  }

  // --- APPOINTMENTS ---
  async createAppointment(data: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'adTitle' | 'clientName' | 'providerName' | 'clientAvatar'>): Promise<Appointment> {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([{
        client_id: data.clientId,
        provider_id: data.providerId,
        ad_id: data.adId,
        date: data.date,
        time: data.time,
        notes: data.notes,
        client_location: data.clientLocation
      }])
      .select()
      .single();

    if (error) { console.error("Store Error [createAppointment]:", error); throw error; }

    return {
      id: appointment.id,
      clientId: appointment.client_id,
      providerId: appointment.provider_id,
      adId: appointment.ad_id,
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes,
      status: appointment.status as AppointmentStatus,
      createdAt: appointment.created_at,
      clientLocation: appointment.client_location,
      reviewed: appointment.reviewed
    };
  }

  async getMyAppointments(userId: string, role: UserRole): Promise<Appointment[]> {
    const query = supabase.from('appointments').select(`
      *,
      service_ads(title),
      client:profiles!appointments_client_id_fkey(name, avatar),
      provider:profiles!appointments_provider_id_fkey(name)
    `);

    if (role === 'CLIENT') {
      query.eq('client_id', userId);
    } else {
      query.eq('provider_id', userId);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) { console.error("Store Error [getMyAppointments]:", error); throw error; }

    return (data || []).map((app: any) => ({
      id: app.id,
      clientId: app.client_id,
      providerId: app.provider_id,
      adId: app.ad_id,
      date: app.date,
      time: app.time,
      notes: app.notes,
      status: app.status as AppointmentStatus,
      createdAt: app.created_at,
      clientLocation: app.client_location,
      reviewed: app.reviewed,
      adTitle: app.service_ads?.title,
      clientName: app.client?.name,
      clientAvatar: app.client?.avatar,
      providerName: app.provider?.name
    }));
  }

  async markAppointmentReviewed(id: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({ reviewed: true })
      .eq('id', id);

    if (error) { console.error("Store Error [markAppointmentReviewed]:", error); throw error; }
  }

  async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);

    if (error) { console.error("Store Error [updateAppointmentStatus]:", error); throw error; }
  }

  async findChatForAppointment(adId: string, clientId: string, providerId: string): Promise<string | null> {
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        chat_participants(user_id)
      `)
      .eq('ad_id', adId);

    if (error) { console.error("Store Error [findChatForAppointment]:", error); return null; }

    const session = (sessions || []).find(s => {
      const participants = (s.chat_participants || []).map((p: any) => p.user_id);
      return participants.includes(clientId) && participants.includes(providerId);
    });

    return session?.id || null;
  }

  async notifyAppointmentCancelled(
    appointment: Appointment,
    providerName: string,
    clientName?: string,
    providerId?: string
  ): Promise<void> {
    const chatId = await this.findChatForAppointment(appointment.adId, appointment.clientId, appointment.providerId);
    if (!chatId) {
      console.warn("Chat not found for appointment", appointment.id);
      return;
    }

    const formattedDate = new Date(appointment.date).toLocaleDateString('pt-BR');
    const senderId = providerId || appointment.providerId;
    const name = clientName || appointment.clientName || 'Cliente';
    const text = `Olá, ${name}! Infelizmente, precisei cancelar o agendamento do dia ${formattedDate} às ${appointment.time}. Peço desculpas pelo transtorno. Podemos remarcar para outro horário se você quiser!`;

    await this.sendMessage(chatId, senderId, text);
  }

  async notifyAppointmentConfirmed(
    appointment: Appointment,
    providerName: string,
    clientName?: string,
    providerId?: string
  ): Promise<void> {
    const chatId = await this.findChatForAppointment(appointment.adId, appointment.clientId, appointment.providerId);
    if (!chatId) {
      console.warn("Chat not found for appointment", appointment.id);
      return;
    }

    const formattedDate = new Date(appointment.date).toLocaleDateString('pt-BR');
    const senderId = providerId || appointment.providerId;
    const name = clientName || appointment.clientName || 'Cliente';
    const text = `Olá, ${name}! Seu agendamento para o dia ${formattedDate} às ${appointment.time} foi confirmado! Qualquer dúvida é só me chamar. Até lá!`;

    await this.sendMessage(chatId, senderId, text);
  }

  // ==================================================================
  //  MÓDULO DO ADMIN / DONO (painel /owner)
  // ==================================================================

  // --- Configurações ---
  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) { console.error("Store Error [getSetting]:", error); return null; }
    return data?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) { console.error("Store Error [setSetting]:", error); throw error; }
  }

  async getAdDurationDays(): Promise<number> {
    const value = await this.getSetting('ad_duration_days');
    const parsed = parseInt(value || '', 10);
    return isNaN(parsed) || parsed <= 0 ? 30 : parsed;
  }

  async setAdDurationDays(days: number): Promise<void> {
    await this.setSetting('ad_duration_days', String(Math.max(1, Math.round(days))));
  }

  // --- Categorias ---
  async getCategories(): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) return data.map(c => this.mapCategory(c));
    } catch (e) {
      console.error("Store Error [getCategories]:", e);
    }
    return DEFAULT_CATEGORIES.map(c => ({
      id: c.slug, slug: c.slug, name: c.name, icon: c.icon, sortOrder: c.sortOrder, active: true
    }));
  }

  async getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) { console.error("Store Error [getAllCategories]:", error); throw error; }
    return (data || []).map(c => this.mapCategory(c));
  }

  async createCategory(cat: { slug: string; name: string; icon: string; sortOrder: number }): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .insert([{
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        sort_order: cat.sortOrder
      }]);
    if (error) { console.error("Store Error [createCategory]:", error); throw error; }
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    const u: any = {};
    if (updates.slug !== undefined) u.slug = updates.slug;
    if (updates.name !== undefined) u.name = updates.name;
    if (updates.icon !== undefined) u.icon = updates.icon;
    if (updates.sortOrder !== undefined) u.sort_order = updates.sortOrder;
    if (updates.active !== undefined) u.active = updates.active;
    const { error } = await supabase.from('categories').update(u).eq('id', id);
    if (error) { console.error("Store Error [updateCategory]:", error); throw error; }
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { console.error("Store Error [deleteCategory]:", error); throw error; }
  }

  // --- Moderação de anúncios ---
  async getAllAds(params?: { status?: string; search?: string; limit?: number }): Promise<ServiceAd[]> {
    let query = supabase.from('service_ads').select('*, profiles(name, avatar, is_certified)');
    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.search) {
      query = query.or(`title.ilike.%${params.search}%,location.ilike.%${params.search}%`);
    }
    const limit = params?.limit || 200;
    query = query.range(0, limit - 1).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) { console.error("Store Error [getAllAds]:", error); throw error; }
    return (data || []).map(ad => this.mapAd(ad));
  }

  async updateAdStatus(id: string, status: AdStatus, reason?: string): Promise<void> {
    const update: any = { status };
    if (status === 'approved') {
      update.rejection_reason = null;
      const { data: existing } = await supabase
        .from('service_ads')
        .select('expires_at')
        .eq('id', id)
        .single();
      if (!existing?.expires_at) {
        const days = await this.getAdDurationDays();
        update.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }
    } else if (reason !== undefined) {
      update.rejection_reason = reason || null;
    }

    const { error } = await supabase.from('service_ads').update(update).eq('id', id);
    if (error) { console.error("Store Error [updateAdStatus]:", error); throw error; }
  }

  async setAdExpiration(id: string, expiresAtIso: string): Promise<void> {
    const { error } = await supabase.from('service_ads').update({ expires_at: expiresAtIso }).eq('id', id);
    if (error) { console.error("Store Error [setAdExpiration]:", error); throw error; }
  }

  async extendAd(id: string, days: number): Promise<void> {
    const { data } = await supabase.from('service_ads').select('expires_at').eq('id', id).single();
    const now = Date.now();
    const base = data?.expires_at ? Math.max(new Date(data.expires_at).getTime(), now) : now;
    await this.setAdExpiration(id, new Date(base + days * 24 * 60 * 60 * 1000).toISOString());
  }

  /**
   * Marca como 'expired' os anúncios aprovados cuja data de expiração já passou.
   * A RLS permite o provider expirar os próprios anúncios e o admin todos.
   */
  async expireAds(): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('service_ads')
      .update({ status: 'expired' })
      .eq('status', 'approved')
      .lt('expires_at', now)
      .select('id');
    if (error) { console.error("Store Error [expireAds]:", error); throw error; }
    return (data || []).length;
  }

  // --- Usuários ---
  // RPC SECURITY DEFINER: somente admin com 'manage_users' (ou dono) lê PII.
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.rpc('get_admin_user_list');
    if (error) { console.error("Store Error [getUsers]:", error); throw error; }
    return (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email || '',
      role: u.role as UserRole,
      avatar: u.avatar,
      location: u.location,
      phone: u.phone || '',
      bio: u.bio,
      isSuspended: u.is_suspended || false,
      isOwner: u.is_owner || false,
      isCertified: u.is_certified || false,
      roleRequest: u.role_request || null,
      createdAt: u.created_at
    }));
  }

  /** Muda papel CLIENT/PROVIDER de um usuário — RPC (somente o dono). */
  async setUserRole(id: string, role: UserRole): Promise<void> {
    if (role === UserRole.ADMIN) throw new Error("Para promover admins, use a ação específica.");
    const { error } = await supabase.rpc('set_user_role', { target_user: id, new_role: role });
    if (error) { console.error("Store Error [setUserRole]:", error); throw error; }
  }

  /** Promove a ADMIN — RPC (somente o dono). */
  async promoteToAdmin(id: string): Promise<void> {
    const { error } = await supabase.rpc('promote_to_admin', { target_user: id });
    if (error) { console.error("Store Error [promoteToAdmin]:", error); throw error; }
  }

  /** Destitui um ADMIN — RPC (somente o dono; dono protegido). */
  async demoteFromAdmin(id: string): Promise<void> {
    const { error } = await supabase.rpc('demote_from_admin', { target_user: id });
    if (error) { console.error("Store Error [demoteFromAdmin]:", error); throw error; }
  }

  /** Transfere a posse do projeto — RPC (somente o dono atual). */
  async transferOwnership(newOwnerId: string): Promise<void> {
    const { error } = await supabase.rpc('transfer_ownership', { new_owner: newOwnerId });
    if (error) { console.error("Store Error [transferOwnership]:", error); throw error; }
  }

  /** Suspende/reativa usuário — RPC (admin ou dono). */
  async setUserSuspended(id: string, suspended: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_user_suspended', { target_user: id, suspended });
    if (error) { console.error("Store Error [setUserSuspended]:", error); throw error; }
  }

  /** Cliente solicita virar profissional — RPC (próprio usuário). */
  async requestProviderRole(): Promise<void> {
    const { error } = await supabase.rpc('request_provider_role');
    if (error) { console.error("Store Error [requestProviderRole]:", error); throw error; }
  }

  /** Cliente cancela a solicitação de profissional — RPC (próprio usuário). */
  async cancelProviderRequest(): Promise<void> {
    const { error } = await supabase.rpc('cancel_provider_request');
    if (error) { console.error("Store Error [cancelProviderRequest]:", error); throw error; }
  }

  /** Aprova solicitação de profissional — RPC (admin ou dono). */
  async approveProviderRequest(id: string): Promise<void> {
    const { error } = await supabase.rpc('approve_provider_request', { target_user: id });
    if (error) { console.error("Store Error [approveProviderRequest]:", error); throw error; }
  }

  /** Recusa solicitação de profissional — RPC (admin ou dono). */
  async rejectProviderRequest(id: string): Promise<void> {
    const { error } = await supabase.rpc('reject_provider_request', { target_user: id });
    if (error) { console.error("Store Error [rejectProviderRequest]:", error); throw error; }
  }

  /** Concede/remove o selo de profissional verificado — RPC (admin ou dono). */
  async setUserCertified(id: string, certified: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_user_certified', { target_user: id, certified });
    if (error) { console.error("Store Error [setUserCertified]:", error); throw error; }
  }

  /** Consulta as permissões de um admin — RPC (somente o dono). */
  async getAdminPermissions(userId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_admin_permissions', { target_user: userId });
    if (error) { console.error("Store Error [getAdminPermissions]:", error); throw error; }
    return Array.isArray(data) ? data : [];
  }

  /** Define as permissões de um admin — RPC (somente o dono). */
  async setAdminPermissions(userId: string, perms: string[]): Promise<void> {
    const { error } = await supabase.rpc('set_admin_permissions', { target_user: userId, perms });
    if (error) { console.error("Store Error [setAdminPermissions]:", error); throw error; }
  }

  // --- Métricas ---
  async getAdminStats(): Promise<AdminStats> {
    const count = async (table: any, filters?: (q: any) => any): Promise<number> => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (filters) q = filters(q);
      const { count: c, error } = await q;
      if (error) console.error("Store Error [getAdminStats]", table, error);
      return c || 0;
    };
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsers, providers, clients, admins, newUsersWeek,
      totalAds, adsPending, adsApproved, adsRejected, adsExpired, adsSuspended, newAdsWeek,
      totalAppointments, appointmentsPending, appointmentsConfirmed, appointmentsCompleted,
      appointmentsCancelled, newAppointmentsWeek,
      totalReviews
    ] = await Promise.all([
      count('profiles'),
      count('profiles', q => q.eq('role', 'PROVIDER')),
      count('profiles', q => q.eq('role', 'CLIENT')),
      count('profiles', q => q.eq('role', 'ADMIN')),
      count('profiles', q => q.gte('created_at', weekAgo)),
      count('service_ads'),
      count('service_ads', q => q.eq('status', 'pending')),
      count('service_ads', q => q.eq('status', 'approved')),
      count('service_ads', q => q.eq('status', 'rejected')),
      count('service_ads', q => q.eq('status', 'expired')),
      count('service_ads', q => q.eq('status', 'suspended')),
      count('service_ads', q => q.gte('created_at', weekAgo)),
      count('appointments'),
      count('appointments', q => q.eq('status', 'pending')),
      count('appointments', q => q.eq('status', 'confirmed')),
      count('appointments', q => q.eq('status', 'completed')),
      count('appointments', q => q.eq('status', 'cancelled')),
      count('appointments', q => q.gte('created_at', weekAgo)),
      count('reviews'),
    ]);

    const { data: reviewRows } = await supabase.from('reviews').select('rating');
    const avgRating = reviewRows && reviewRows.length > 0
      ? Number((reviewRows.reduce((a: number, r: any) => a + (r.rating || 0), 0) / reviewRows.length).toFixed(1))
      : 0;

    // Distribuição de anúncios ativos por categoria
    const { data: adsRows } = await supabase.from('service_ads').select('category, status, views');
    const byCategory = new Map<string, number>();
    let totalViews = 0;
    for (const row of adsRows || []) {
      if (row.status === 'approved') {
        byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
        totalViews += row.views || 0;
      }
    }
    const adsByCategory = Array.from(byCategory.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Top anúncios mais avaliados
    const { data: topRows } = await supabase
      .from('service_ads')
      .select('id, title, category, rating, review_count, views, profiles(name)')
      .eq('status', 'approved')
      .order('review_count', { ascending: false })
      .limit(5);
    const topAds = (topRows || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      providerName: r.profiles?.name || '—',
      category: r.category,
      rating: r.rating || 0,
      reviewCount: r.review_count || 0,
      views: r.views || 0,
    }));

    return {
      totalUsers, providers, clients, admins, newUsersWeek,
      totalAds, adsPending, adsApproved, adsRejected, adsExpired, adsSuspended, newAdsWeek,
      totalAppointments, appointmentsPending, appointmentsConfirmed, appointmentsCompleted,
      appointmentsCancelled, newAppointmentsWeek,
      totalReviews, avgRating, adsByCategory, topAds, totalViews
    };
  }

  // --- MARKET STANDARD FEATURES: FAVORITES ---
  private getFavKey(userId: string) { return `mestrio_favs_${userId}`; }

  async getFavorites(userId: string): Promise<ServiceAd[]> {
    try {
      const stored = localStorage.getItem(this.getFavKey(userId));
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (!ids.length) return [];
      const all = await this.getAllAds({ status: 'approved', limit: 200 });
      return all.filter(a => ids.includes(a.id));
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async toggleFavorite(userId: string, adId: string): Promise<boolean> {
    try {
      const stored = localStorage.getItem(this.getFavKey(userId));
      let ids: string[] = stored ? JSON.parse(stored) : [];
      let added = false;
      if (ids.includes(adId)) {
        ids = ids.filter(id => id !== adId);
      } else {
        ids.push(adId);
        added = true;
      }
      localStorage.setItem(this.getFavKey(userId), JSON.stringify(ids));
      return added;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async isFavorite(userId: string, adId: string): Promise<boolean> {
    try {
      const stored = localStorage.getItem(this.getFavKey(userId));
      const ids: string[] = stored ? JSON.parse(stored) : [];
      return ids.includes(adId);
    } catch (e) {
      return false;
    }
  }

  // --- MARKET STANDARD FEATURES: JOB REQUESTS & QUOTES ---
  private JOB_REQUESTS_KEY = 'mestrio_job_requests';
  private QUOTES_KEY = 'mestrio_quote_proposals';

  async getJobRequests(): Promise<JobRequest[]> {
    try {
      const stored = localStorage.getItem(this.JOB_REQUESTS_KEY);
      if (stored) return JSON.parse(stored);
      // Mock initial seed if empty
      const initial: JobRequest[] = [
        {
          id: 'jr-1',
          clientId: 'u-client-1',
          clientName: 'Ana Souza',
          title: 'Reparo elétrico e instalação de disjuntor',
          description: 'Preciso de eletricista para trocar caixa de disjuntores e revisar tomada da cozinha.',
          category: 'Eletricista',
          location: 'São Paulo, SP',
          budget: 350,
          status: 'open',
          proposalsCount: 2,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'jr-2',
          clientId: 'u-client-2',
          clientName: 'Carlos Eduardo',
          title: 'Pintura de sala 30m²',
          description: 'Pintura de paredes internas com tinta acrílica lavável branca.',
          category: 'Pintor',
          location: 'Campinas, SP',
          budget: 600,
          status: 'open',
          proposalsCount: 1,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        }
      ];
      localStorage.setItem(this.JOB_REQUESTS_KEY, JSON.stringify(initial));
      return initial;
    } catch (e) {
      return [];
    }
  }

  async createJobRequest(req: Omit<JobRequest, 'id' | 'createdAt' | 'status' | 'proposalsCount'>): Promise<JobRequest> {
    const list = await this.getJobRequests();
    const newReq: JobRequest = {
      ...req,
      id: `jr-${Date.now()}`,
      status: 'open',
      proposalsCount: 0,
      createdAt: new Date().toISOString()
    };
    list.unshift(newReq);
    localStorage.setItem(this.JOB_REQUESTS_KEY, JSON.stringify(list));
    return newReq;
  }

  async updateJobRequestStatus(id: string, status: JobRequest['status']): Promise<void> {
    const list = await this.getJobRequests();
    const item = list.find(r => r.id === id);
    if (item) {
      item.status = status;
      localStorage.setItem(this.JOB_REQUESTS_KEY, JSON.stringify(list));
    }
  }

  async getQuoteProposals(jobRequestId?: string, providerId?: string): Promise<QuoteProposal[]> {
    try {
      const stored = localStorage.getItem(this.QUOTES_KEY);
      const list: QuoteProposal[] = stored ? JSON.parse(stored) : [];
      return list.filter(q => {
        if (jobRequestId && q.jobRequestId !== jobRequestId) return false;
        if (providerId && q.providerId !== providerId) return false;
        return true;
      });
    } catch (e) {
      return [];
    }
  }

  async createQuoteProposal(proposal: Omit<QuoteProposal, 'id' | 'createdAt' | 'status'>): Promise<QuoteProposal> {
    const stored = localStorage.getItem(this.QUOTES_KEY);
    const list: QuoteProposal[] = stored ? JSON.parse(stored) : [];
    const newQuote: QuoteProposal = {
      ...proposal,
      id: `quote-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    list.unshift(newQuote);
    localStorage.setItem(this.QUOTES_KEY, JSON.stringify(list));

    if (proposal.jobRequestId) {
      const jobs = await this.getJobRequests();
      const job = jobs.find(j => j.id === proposal.jobRequestId);
      if (job) {
        job.proposalsCount = (job.proposalsCount || 0) + 1;
        localStorage.setItem(this.JOB_REQUESTS_KEY, JSON.stringify(jobs));
      }
    }
    return newQuote;
  }

  async updateQuoteStatus(id: string, status: QuoteProposal['status']): Promise<void> {
    const stored = localStorage.getItem(this.QUOTES_KEY);
    const list: QuoteProposal[] = stored ? JSON.parse(stored) : [];
    const item = list.find(q => q.id === id);
    if (item) {
      item.status = status;
      localStorage.setItem(this.QUOTES_KEY, JSON.stringify(list));
    }
  }

  // --- MARKET STANDARD FEATURES: PROFESSIONAL SCHEDULE ---
  private getSchedKey(providerId: string) { return `mestrio_sched_${providerId}`; }

  async getProfessionalSchedule(providerId: string): Promise<ProfessionalSchedule> {
    try {
      const stored = localStorage.getItem(this.getSchedKey(providerId));
      if (stored) return JSON.parse(stored);
      return {
        providerId,
        workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        startTime: '08:00',
        endTime: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        autoApprove: false,
      };
    } catch (e) {
      return {
        providerId,
        workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        startTime: '08:00',
        endTime: '18:00',
      };
    }
  }

  async saveProfessionalSchedule(schedule: ProfessionalSchedule): Promise<void> {
    localStorage.setItem(this.getSchedKey(schedule.providerId), JSON.stringify(schedule));
  }

  // --- MARKET STANDARD FEATURES: AUDIT LOGS ---
  private AUDIT_KEY = 'mestrio_audit_logs';

  async getAuditLogs(): Promise<AuditLogItem[]> {
    try {
      // Tenta buscar do Supabase primeiro
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          adminId: d.admin_id,
          adminEmail: d.admin_email || 'admin@mestrio.com',
          action: d.action,
          targetId: d.target_id,
          targetType: d.target_type,
          details: d.details,
          createdAt: d.created_at,
        }));
      }

      // Fallback em localStorage
      const stored = localStorage.getItem(this.AUDIT_KEY);
      if (stored) return JSON.parse(stored);
      const mockAudit: AuditLogItem[] = [
        { id: 'aud-1', adminId: 'admin-1', adminEmail: 'admin@mestrio.com', action: 'Moderação de Anúncio', targetId: 'ad-101', targetType: 'ServiceAd', details: 'Aprovou anúncio de Pintura Residencial', createdAt: new Date().toISOString() },
        { id: 'aud-2', adminId: 'admin-1', adminEmail: 'admin@mestrio.com', action: 'Aprovação de Profissional', targetId: 'u-202', targetType: 'User', details: 'Aprovou perfil profissional de Marcos Lima', createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 'aud-3', adminId: 'admin-1', adminEmail: 'admin@mestrio.com', action: 'Concessão de Selo', targetId: 'u-303', targetType: 'User', details: 'Atribuiu selo de verificação a Roberto Silva', createdAt: new Date(Date.now() - 7200000).toISOString() },
      ];
      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(mockAudit));
      return mockAudit;
    } catch (e) {
      return [];
    }
  }

  // --- MARKET STANDARD FEATURES: SYSTEM BROADCASTS ---
  private BROADCAST_KEY = 'mestrio_system_broadcasts';

  async getSystemBroadcasts(): Promise<SystemBroadcast[]> {
    try {
      const stored = localStorage.getItem(this.BROADCAST_KEY);
      if (stored) return JSON.parse(stored);
      const initial: SystemBroadcast[] = [
        {
          id: 'bc-1',
          title: 'Bem-vindo ao Novo Mestrio 2.0',
          message: 'Explore o novo mural de orçamentos e facilidades de agendamento em nossa plataforma!',
          targetRole: 'ALL',
          type: 'info',
          createdAt: new Date().toISOString(),
          active: true
        }
      ];
      localStorage.setItem(this.BROADCAST_KEY, JSON.stringify(initial));
      return initial;
    } catch (e) {
      return [];
    }
  }

  async createSystemBroadcast(broadcast: Omit<SystemBroadcast, 'id' | 'createdAt'>): Promise<SystemBroadcast> {
    const list = await this.getSystemBroadcasts();
    const newBc: SystemBroadcast = {
      ...broadcast,
      id: `bc-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    list.unshift(newBc);
    localStorage.setItem(this.BROADCAST_KEY, JSON.stringify(list));
    return newBc;
  }

  async toggleSystemBroadcast(id: string): Promise<void> {
    const list = await this.getSystemBroadcasts();
    const item = list.find(b => b.id === id);
    if (item) {
      item.active = !item.active;
      localStorage.setItem(this.BROADCAST_KEY, JSON.stringify(list));
    }
  }

  // --- MARKET STANDARD FEATURES: CSV EXPORT ---
  exportToCSV(filename: string, rows: Record<string, any>[]): void {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const store = new Store();

