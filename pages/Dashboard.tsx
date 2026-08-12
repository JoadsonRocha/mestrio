import React, { useEffect, useState } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { 
  Settings, MessageSquare, Calendar, Megaphone, LayoutDashboard, 
  Heart, Briefcase, Calculator, Home, CheckCircle2, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { store } from '../services/store';

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }

    // Carrega contador de mensagens não lidas
    store.getGlobalUnreadCount(user.id)
      .then(count => setUnreadChatCount(count))
      .catch(() => setUnreadChatCount(0));
  }, [user, loading, navigate, location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const isClient = user.role === UserRole.CLIENT;

  const menuItems = [
    { to: '/dashboard', label: 'Meu Painel', icon: LayoutDashboard },
    { 
      to: '/dashboard/chat', 
      label: 'Chat', 
      icon: MessageSquare,
      badge: unreadChatCount > 0 ? unreadChatCount : undefined 
    },
    { to: '/dashboard/appointments', label: 'Meus Agendamentos', icon: Calendar },
    { to: '/dashboard/job-requests', label: isClient ? 'Solicitar Orçamento' : 'Oportunidades', icon: Briefcase },
    ...(isClient 
      ? [{ to: '/dashboard/favorites', label: 'Favoritos', icon: Heart }] 
      : [
          { to: '/dashboard/ads', label: 'Meus Anúncios', icon: Megaphone },
          { to: '/dashboard/quote-builder', label: 'Gerador de Orçamentos IA', icon: Calculator }
        ]),
  ];

  const getItemClass = (to: string) => {
    const active = to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(to);
    if (active) {
      return 'bg-brand-600 text-white font-semibold shadow-sm shadow-brand-200';
    }
    return 'text-gray-700 hover:bg-brand-50 hover:text-brand-700 font-medium';
  };

  const getIconClass = (to: string) => {
    const active = to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(to);
    return active ? 'text-white' : 'text-brand-600 group-hover:text-brand-700';
  };

  return (
    <div className="h-full bg-gray-50 overflow-hidden">
      <div className="px-3 h-full flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full min-h-0">
          
          {/* Sidebar Profile & Navigation */}
          <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col overflow-hidden min-h-0">
            
            {/* Header do Perfil */}
            <div className="flex flex-col items-center text-center p-3 rounded-lg bg-gradient-to-b from-gray-50/80 to-transparent border border-gray-100/60 mb-2">
              <div className="relative mb-2">
                <img 
                  loading="lazy" 
                  decoding="async" 
                  src={user.avatar || 'https://via.placeholder.com/100'} 
                  alt={user.name} 
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-brand-500/20 shadow-sm" 
                />
                {user.isCertified && (
                  <span className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full shadow-sm" title="Profissional Certificado">
                    <CheckCircle2 size={12} />
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-gray-900 truncate max-w-full">{user.name}</h2>
              <p className="text-gray-500 text-xs truncate max-w-full mb-2">{user.email}</p>
              
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isClient 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                    : 'bg-brand-50 text-brand-700 border border-brand-100'
                }`}>
                  {isClient ? 'Cliente' : 'Profissional'}
                </span>
                {user.isCertified && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                    <UserCheck size={10} />
                    Verificado
                  </span>
                )}
              </div>
            </div>

            {/* Menu de Navegação */}
            <div className="mt-2 flex-1 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">
                Navegação
              </p>
              <nav className="space-y-1">
                {menuItems.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-sm ${getItemClass(item.to)}`}
                  >
                    <div className="flex items-center min-w-0">
                      <item.icon size={18} className={`mr-3 shrink-0 ${getIconClass(item.to)}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 ${
                        getItemClass(item.to).includes('bg-brand-600')
                          ? 'bg-white text-brand-700'
                          : 'bg-green-500 text-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Ações Inferiores (Sem botão Sair) */}
            <div className="mt-auto pt-3 border-t border-gray-100 space-y-1.5">
              <Link 
                to="/profile/edit" 
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium"
              >
                <Settings size={16} className="text-gray-500" /> 
                Editar Perfil
              </Link>
              <Link 
                to="/" 
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50/60 px-3 py-2 rounded-lg transition-all text-sm font-medium"
              >
                <Home size={16} /> 
                Voltar ao Início
              </Link>
            </div>

          </aside>

          {/* Área Principal do Conteúdo */}
          <div className={`lg:col-span-3 h-full min-h-0 ${location.pathname === '/dashboard' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
