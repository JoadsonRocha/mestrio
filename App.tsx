
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar, Footer, MobileBottomNav } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
const lazyRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';
      
      if (isChunkError) {
        const reloadKey = `railway_chunk_reload_${window.location.pathname}`;
        const lastReload = sessionStorage.getItem(reloadKey);
        if (!lastReload) {
          sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });

const Home = lazyRetry(() => import('./pages/Home'));
const SearchPage = lazyRetry(() => import('./pages/Search'));
const ServiceDetail = lazyRetry(() => import('./pages/ServiceDetail'));
const CreateAd = lazyRetry(() => import('./pages/CreateAd'));
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const DashboardHome = lazyRetry(() => import('./pages/DashboardHome'));
const Appointments = lazyRetry(() => import('./pages/Appointments'));
const Ads = lazyRetry(() => import('./pages/Ads'));
const Login = lazyRetry(() => import('./pages/Login'));
const Chat = lazyRetry(() => import('./pages/Chat'));
const EditProfile = lazyRetry(() => import('./pages/EditProfile'));
const CategoryPage = lazyRetry(() => import('./pages/CategoryPage'));
const PublicProfile = lazyRetry(() => import('./pages/PublicProfile'));
const Terms = lazyRetry(() => import('./pages/Terms'));
const Privacy = lazyRetry(() => import('./pages/Privacy'));
const OwnerDashboard = lazyRetry(() => import('./admin/pages/OwnerDashboard'));
const FavoritesTab = lazyRetry(() => import('./components/FavoritesTab').then(m => ({ default: m.FavoritesTab })));
const JobRequestsTab = lazyRetry(() => import('./components/JobRequestsTab').then(m => ({ default: m.JobRequestsTab })));
const QuoteBuilder = lazyRetry(() => import('./components/QuoteBuilder').then(m => ({ default: m.QuoteBuilder })));
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CategoriesProvider } from './context/CategoriesContext';

const PAGE_TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/$/, title: 'Início' },
  { match: /^\/search/, title: 'Buscar Serviços' },
  { match: /^\/categoria\//, title: 'Categorias' },
  { match: /^\/service\//, title: 'Detalhes do Serviço' },
  { match: /^\/profissional\//, title: 'Profissional' },
  { match: /^\/create-ad/, title: 'Anunciar Serviço' },
  { match: /^\/edit-ad/, title: 'Editar Anúncio' },
  { match: /^\/dashboard\/chat/, title: 'Mensagens' },
  { match: /^\/dashboard\/appointments/, title: 'Meus Agendamentos' },
  { match: /^\/dashboard\/ads/, title: 'Meus Anúncios' },
  { match: /^\/dashboard\/favorites/, title: 'Favoritos' },
  { match: /^\/dashboard\/job-requests/, title: 'Pedidos de Serviços' },
  { match: /^\/dashboard\/quote-builder/, title: 'Gerador de Orçamentos IA' },
  { match: /^\/dashboard/, title: 'Meu Painel' },
  { match: /^\/owner/, title: 'Painel do Dono' },
  { match: /^\/profile\/edit/, title: 'Editar Perfil' },
  { match: /^\/login/, title: 'Entrar' },
  { match: /^\/terms/, title: 'Termos de Uso' },
  { match: /^\/privacy/, title: 'Política de Privacidade' },
];

const MainLayout: React.FC = () => {
  const location = useLocation();
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isOwnerRoute = location.pathname.startsWith('/owner');
  const isLoginRoute = location.pathname.startsWith('/login');
  const isServiceDetailRoute = location.pathname.startsWith('/service/');
  const isPublicProfileRoute = location.pathname.startsWith('/profissional/');
  const isChatConversation = /^\/dashboard\/chat\/.+/.test(location.pathname);

  const showMobileBottomNav =
    !isOwnerRoute &&
    !isLoginRoute &&
    !isServiceDetailRoute &&
    !isPublicProfileRoute &&
    !isChatConversation;

  useEffect(() => {
    const found = PAGE_TITLES.find(p => p.match.test(location.pathname));
    document.title = found ? `${found.title} | Mestrio` : 'Mestrio';
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // /dashboard usa layout fixo com scroll interno (chat)
  // /owner usa layout normal com scroll vertical da página
  const isFixedLayout = isDashboardRoute;

  return (
    <div className={`flex flex-col bg-gray-50 ${isFixedLayout ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {!isOwnerRoute && <Navbar />}
      <main id="main-content" className={`flex-grow flex flex-col ${isFixedLayout ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <Suspense fallback={
          <div className="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-4xl mx-auto space-y-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="w-full h-32 bg-gray-200 rounded"></div>
            <div className="w-full h-32 bg-gray-200 rounded"></div>
            <div className="w-full h-32 bg-gray-200 rounded"></div>
          </div>
        }>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/categoria/:id" element={<CategoryPage />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          <Route path="/profissional/:id" element={<PublicProfile />} />
          <Route path="/create-ad" element={<CreateAd />} />
          <Route path="/edit-ad/:id" element={<CreateAd />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="ads" element={<Ads />} />
            <Route path="chat" element={<Chat />} />
            <Route path="chat/:id" element={<Chat />} />
            <Route path="favorites" element={<FavoritesTab />} />
            <Route path="job-requests" element={<JobRequestsTab />} />
            <Route path="quote-builder" element={<QuoteBuilder />} />
          </Route>

          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/chat" element={<Navigate to="/dashboard/chat" replace />} />
          <Route path="/chat/:id" element={<Navigate to="/dashboard/chat/:id" replace />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </ErrorBoundary>
        </Suspense>
      </main>
      {!isDashboardRoute && !isOwnerRoute && !isLoginRoute && <Footer />}
      {showMobileBottomNav && <MobileBottomNav />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <CategoriesProvider>
          <Router>
            <MainLayout />
          </Router>
        </CategoriesProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
