/**
 * Define os papéis de usuário (roles) disponíveis no sistema.
 */
export enum UserRole {
  CLIENT = 'CLIENT',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN'
}

/**
 * Estrutura principal do Usuário (Cliente, Profissional ou Admin).
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  location?: string;
  phone?: string;
  bio?: string;
  documentNumber?: string;
  hasCompletedOnboarding?: boolean;
  isCertified?: boolean;
  isSuspended?: boolean;
  isOwner?: boolean;
  roleRequest?: string | null;
  permissions?: string[];
  referralCode?: string;
  referredBy?: string;
  referralCredits?: number;
  referralCashEarnings?: number;
  beforeAfterProjects?: BeforeAfterProject[];
  createdAt?: string;
}

/**
 * Permissões detalhadas para administradores do sistema.
 */
export type AdminPermission =
  | 'moderate_ads'
  | 'manage_users'
  | 'approve_providers'
  | 'verify_providers'
  | 'manage_categories'
  | 'manage_settings'
  | 'manage_reports'
  | 'manage_kyc'
  | 'view_metrics';

/** Status possíveis para um anúncio (ServiceAd) */
export type AdStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'suspended';

/**
 * Estrutura de categoria de serviço, usada para agrupar e filtrar anúncios e pedidos.
 */
export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  active: boolean;
}

export interface AdminStats {
  totalUsers: number;
  providers: number;
  clients: number;
  admins: number;
  newUsersWeek: number;
  totalAds: number;
  adsPending: number;
  adsApproved: number;
  adsRejected: number;
  adsExpired: number;
  adsSuspended: number;
  newAdsWeek: number;
  totalAppointments: number;
  appointmentsPending: number;
  appointmentsConfirmed: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  newAppointmentsWeek: number;
  totalReviews: number;
  avgRating: number;
  totalViews: number;
  adsByCategory: { category: string; count: number }[];
  topAds: {
    id: string;
    title: string;
    providerName: string;
    category: string;
    rating: number;
    reviewCount: number;
    views: number;
  }[];
}

/**
 * Avaliação feita por um cliente a um profissional/anúncio.
 */
export interface Review {
  id: string;
  authorId: string;
  authorName: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface BeforeAfterProject {
  id: string;
  title: string;
  category?: string;
  description?: string;
  beforeImage: string;
  afterImage: string;
  date?: string;
}

/**
 * Anúncio de um serviço oferecido por um prestador.
 */
export interface ServiceAd {
  id: string;
  providerId: string;
  providerName: string;
  title: string;
  description: string;
  category: string;
  price: number;
  priceUnit: 'hour' | 'job' | 'estimate';
  location: string;
  images: string[];
  beforeAfterProjects?: BeforeAfterProject[];
  rating: number;
  reviewCount: number;
  reviews: Review[];
  isPremium?: boolean;
  createdAt: string;
  whatsapp: string;
  availability?: string; 
  tags?: string[];
  isCertified?: boolean;
  providerAvatar?: string;
  status?: AdStatus;
  expiresAt?: string;
  rejectionReason?: string;
  views?: number;
  lat?: number;
  lng?: number;
  riskScore?: number;
  safetyFlags?: string[];
  safetyCategories?: string[];
}

/**
 * Representa os filtros selecionados na busca.
 */
export interface FilterState {
  category: string;
  query: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
}

export type ToastType = 'success' | 'error' | 'info';

/**
 * Mensagem de notificação toast na interface de usuário.
 */
export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

/**
 * Mensagem individual do chat.
 */
export interface Message {
  id: string;
  senderId: string;
  text: string;
  read: boolean;
  timestamp: string;
}

/**
 * Sessão de chat entre usuários (geralmente cliente e prestador) referente a um anúncio.
 */
export interface ChatSession {
  id: string;
  participants: string[]; // [userId1, userId2]
  adId: string;
  adTitle: string;
  otherUserName?: string;
  providerName?: string;
  clientName?: string;
  lastMessage?: string;
  unreadCount?: number;
  updatedAt: string;
  messages: Message[];
}

/** Status de um agendamento */
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

/**
 * Agendamento de serviço entre cliente e prestador.
 */
export interface Appointment {
  id: string;
  clientId: string;
  providerId: string;
  adId: string;
  date: string;
  time: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
  clientLocation?: string;
  reviewed?: boolean;
  
  // Dados populados no Join (junção de tabelas)
  adTitle?: string;
  clientName?: string;
  providerName?: string;
  clientAvatar?: string;
}

/**
 * Anúncio de Pedido de Serviço (Demanda criada por um cliente para receber propostas de prestadores).
 */
export interface JobRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  clientPhone?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  budget?: number;
  urgency?: 'urgent' | 'this_week' | 'flexible';
  photos?: string[];
  preferredContactMethod?: 'whatsapp' | 'chat' | 'phone';
  status: 'open' | 'in_progress' | 'closed';
  proposalsCount?: number;
  createdAt: string;
}

/**
 * Proposta de orçamento (Quote) enviada por um prestador em resposta a um Job Request.
 */
export interface QuoteProposal {
  id: string;
  jobRequestId?: string;
  adId?: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  clientId: string;
  estimatedPrice: number;
  estimatedDays: number;
  description: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

/**
 * Item detalhado de um orçamento comercial (mão de obra, material, serviço ou taxa).
 */
export interface DetailedQuoteItem {
  id: string;
  description: string;
  type: 'labor' | 'material' | 'service' | 'tax' | 'other';
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'completed';

/**
 * Estrutura completa de um Orçamento Comercial Profissional no Mestrio.
 */
export interface DetailedQuote {
  id: string;
  quoteNumber: string;
  providerId: string;
  providerName: string;
  providerDocument?: string;
  providerPhone?: string;
  providerEmail?: string;
  providerPixKey?: string;
  providerCity?: string;
  
  clientName: string;
  clientDocument?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;

  title: string;
  category: string;
  problemDescription?: string;
  
  items: DetailedQuoteItem[];
  
  subtotal: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  travelFee: number;
  totalAmount: number;
  
  estimatedDays: string;
  validityDays: string;
  paymentTerms: string;
  notes?: string;
  warranty?: string;
  
  status: QuoteStatus;
  
  // Assinatura e Quitação
  providerSignature?: string;
  clientSignature?: string;
  signedAt?: string;
  paidAt?: string;
  receiptNumber?: string;
  paymentMethod?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalSchedule {
  providerId: string;
  workDays: string[];
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  autoApprove?: boolean;
}

export interface AuditLogItem {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  createdAt: string;
}

export interface SystemBroadcast {
  id: string;
  title: string;
  message: string;
  targetRole: 'ALL' | 'CLIENT' | 'PROVIDER';
  type: 'info' | 'warning' | 'success';
  createdAt: string;
  active: boolean;
}

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'resolved';

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetType: 'ad' | 'user' | 'review';
  targetId: string;
  targetTitle?: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  createdAt: string;
}

export type KYCStatus = 'pending' | 'approved' | 'rejected';

export interface KYCDocument {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  documentType: 'CPF' | 'CNH' | 'RG';
  documentNumber: string;
  documentFrontUrl: string;
  selfieUrl?: string;
  status: KYCStatus;
  rejectionReason?: string;
  createdAt: string;
}

export type EscrowPaymentStatus = 'pending' | 'in_escrow' | 'released_to_provider' | 'refunded';