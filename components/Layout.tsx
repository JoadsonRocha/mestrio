import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, PlusCircle, MessageSquare, User, LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoriesContext';
import { store } from '../services/store';

/**
 * Barra de navegação principal (Navbar).
 * Gerencia o roteamento, estado de autenticação (login/logout) e exibe o menu do usuário.
 */
export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, logout } = useAuth();
  const { options } = useCategories();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      store.getGlobalUnreadCount(user.id).then(setUnreadCount);
    }
  }, [user, location.pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setIsOpen(false);
    navigate('/');
    await logout();
  };

  const handleNav = (path: string) => {
    setDropdownOpen(false);
    setIsOpen(false);
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path ? 'text-brand-600 font-semibold' : 'text-gray-600 hover:text-brand-600';
  const isChatActive = location.pathname.startsWith('/dashboard/chat');

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-brand-600 tracking-tight">Mestrio</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link to="/" className={`${isActive('/')} inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium`}>
                Início
              </Link>
              <Link to="/search" className={`${isActive('/search')} inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium`}>
                Buscar Serviços
              </Link>
              <div className="relative flex items-center group">
                <button className="text-gray-600 hover:text-brand-600 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium">
                    Categorias
                </button>
                <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 py-1">
                    {options.filter(c => c.id !== 'all').map(cat => (
                        <Link key={cat.id} to={`/categoria/${cat.id}`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-600">{cat.label}</Link>
                    ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {(!user || user.role !== 'CLIENT') && (
              <Link 
                to="/create-ad" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Anunciar
              </Link>
            )}

            {user ? (
              <div className="relative ml-3 flex items-center space-x-3">
                {/* Ícone de chat com badge */}
                <Link to="/dashboard/chat" className={`${isChatActive ? 'text-brand-600' : 'text-gray-500 hover:text-brand-600'} relative`} title="Mensagens">
                  <MessageSquare className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  )}
                </Link>

                {/* Avatar com Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(prev => !prev)}
                    className="flex items-center space-x-2 text-sm text-gray-700 hover:text-brand-600 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all"
                    title="Menu do usuário"
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 rounded-full object-cover border-2 border-gray-200 hover:border-brand-400 transition-all"
                      src={user.avatar || 'https://via.placeholder.com/100'}
                      alt={user.name}
                    />
                    <span className="font-medium hidden md:block">{user.name.split(' ')[0]}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-fadeIn">
                      {/* Cabeçalho do usuário */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatar || 'https://via.placeholder.com/100'}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover border border-gray-200"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Links do menu */}
                      <div className="py-1">
                        <button
                          onClick={() => handleNav('/dashboard')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
                        >
                          <LayoutDashboard className="w-4 h-4 text-gray-400" />
                          Meu Painel
                        </button>
                        <button
                          onClick={() => handleNav('/profile/edit')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
                        >
                          <User className="w-4 h-4 text-gray-400" />
                          Editar Perfil
                        </button>
                        <button
                          onClick={() => handleNav('/dashboard/chat')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
                        >
                          <MessageSquare className="w-4 h-4 text-gray-400" />
                          Mensagens
                          {unreadCount > 0 && (
                            <span className="ml-auto bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </button>
                        {user.role === 'ADMIN' && (
                          <button
                            onClick={() => handleNav('/owner')}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50 transition-colors text-left font-medium"
                          >
                            <ShieldCheck className="w-4 h-4 text-brand-500" />
                            Painel Admin
                          </button>
                        )}
                      </div>

                      {/* Separador + Sair */}
                      <div className="border-t border-gray-100 py-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors text-left font-semibold"
                        >
                          <LogOut className="w-4 h-4" />
                          Sair da conta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link to="/login" className="text-brand-600 font-medium hover:text-brand-800">
                Entrar / Cadastrar
              </Link>
            )}
          </div>

          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="sm:hidden bg-white border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1">
            <Link onClick={() => setIsOpen(false)} to="/" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-brand-300 hover:text-brand-700">Início</Link>
            <Link onClick={() => setIsOpen(false)} to="/search" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-brand-300 hover:text-brand-700">Buscar</Link>
            {(!user || user.role !== 'CLIENT') && (
              <Link onClick={() => setIsOpen(false)} to="/create-ad" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-300">Anunciar Serviço</Link>
            )}
            {user && (
              <Link onClick={() => setIsOpen(false)} to="/dashboard/chat" className="flex items-center justify-between pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-brand-300">
                Mensagens
                {unreadCount > 0 && (
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">{unreadCount}</span>
                )}
              </Link>
            )}
            {user && (
              <Link onClick={() => setIsOpen(false)} to="/dashboard" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-brand-300 hover:text-brand-700">
                Meu Painel
              </Link>
            )}
            {user && (
              <Link onClick={() => setIsOpen(false)} to="/profile/edit" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-brand-300 hover:text-brand-700">
                Editar Perfil
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link onClick={() => setIsOpen(false)} to="/owner" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-300">
                Painel Admin
              </Link>
            )}
          </div>
          <div className="pt-4 pb-4 border-t border-gray-200">
            {user ? (
              <div>
                <div className="flex items-center px-4 mb-3">
                  <div className="flex-shrink-0">
                    <img loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover" src={user.avatar || 'https://via.placeholder.com/100'} alt="" />
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">{user.name}</div>
                    <div className="text-sm font-medium text-gray-500">{user.email}</div>
                  </div>
                </div>
                {/* Botão Sair no mobile */}
                <div className="px-4">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-50 text-rose-600 font-semibold text-sm hover:bg-rose-100 transition-colors border border-rose-200"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da conta
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4">
                <Link to="/login" onClick={() => setIsOpen(false)} className="block text-center w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-brand-600 hover:bg-brand-700">
                  Entrar
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

/**
 * Rodapé principal da aplicação (Footer).
 * Contém links rápidos, informações de contato e direitos autorais.
 */
export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold text-brand-400 mb-4">Mestrio</h3>
            <p className="text-gray-400 text-sm">
              Conectando clientes a prestadores de serviços autônomos de serviços gerais na sua região. Serviço de qualidade, perto de você.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link to="/search" className="hover:text-white">Buscar Serviços</Link></li>
              <li><Link to="/create-ad" className="hover:text-white">Anunciar</Link></li>
              <li><Link to="/terms" className="hover:text-white">Termos de Uso</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Política de Privacidade</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Contato</h4>
            <p className="text-gray-400 text-sm">suporte@mestrio.com.br</p>
            <p className="text-gray-400 text-sm mt-2">São Paulo, Brasil</p>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Mestrio. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};