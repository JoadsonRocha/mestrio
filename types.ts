export enum UserRole {
  CLIENT = 'CLIENT',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  location?: string;
  phone?: string;
  bio?: string;
  isCertified?: boolean;
  isSuspended?: boolean;
  isOwner?: boolean;
  roleRequest?: string | null;
  permissions?: string[];
  referralCode?: string;
  referredBy?: string;
  referralCredits?: number;
  referralCashEarnings?: number;
  createdAt?: string;
}

export type AdminPermission =
  | 'moderate_ads'
  | 'manage_users'
  | 'approve_providers'
  | 'verify_providers'
  | 'manage_categories'
  | 'manage_settings'
  | 'view_metrics';

export type AdStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'suspended';

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  active: boolean;
}

export interface Tag {
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
  newReviewsWeek: number;
  avgRating: number;
  totalViews: number;
  approvalRate: number;
  avgViewsPerApprovedAd: number;
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

export interface Review {
  id: string;
  authorId: string;
  authorName: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

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
}

export interface FilterState {
  category: string;
  query: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  read: boolean;
  timestamp: string;
}

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

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

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
  
  // Dados populados no Join
  adTitle?: string;
  clientName?: string;
  providerName?: string;
  clientAvatar?: string;
}