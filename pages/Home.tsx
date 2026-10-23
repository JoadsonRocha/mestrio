import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2,
  Users
} from 'lucide-react';
import { store } from '../services/store';
import { ServiceCard } from '../components/UI';
import { categoryIcon } from '../components/CategoryIcon';
import { useCategories } from '../context/CategoriesContext';
import { ServiceAd } from '../types';

const Home: React.FC = () => {
  const { options } = useCategories();
  const [featuredAds, setFeaturedAds] = useState<ServiceAd[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadAds = async () => {
        try {
            // Featured: All active ads, sorted by rating/reviews
            const ads = await store.getAds();
            // Sort locally by rating/reviews
            const featured = ads.sort((a, b) => {
                if (b.rating !== a.rating) return b.rating - a.rating;
                return b.reviewCount - a.reviewCount;
            });
            setFeaturedAds(featured);
        } catch (e) {
            console.error("Erro ao carregar anúncios:", e);
        } finally {
            setLoading(false);
        }
    };
    loadAds();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.append('q', searchTerm.trim());
    navigate(params.toString() ? `/search?${params.toString()}` : `/search`);
  };

  return (
    <div className="flex-1 bg-white flex flex-col">
      {/* Hero Section: Clean, Humano e de Alto Contraste */}
      <section role="banner" className="relative bg-gradient-to-b from-blue-50/70 via-slate-50/40 to-white py-14 md:py-20 border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold tracking-wide mb-5 border border-brand-200/80 shadow-2xs">
            <Users size={14} className="text-brand-600" />
            <span>Marketplace Local de Serviços Gerais</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4 leading-[1.15]">
            Encontre profissionais de confiança <br className="hidden sm:inline" />
            <span className="text-brand-600">para cuidar da sua casa.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 mb-8 leading-relaxed font-normal">
            Conectamos você diretamente com eletricistas, encanadores, pintores e montadores na sua região. Sem intermediação financeira e com contato direto pelo WhatsApp.
          </p>

          {/* Barra de Pesquisa Refinada */}
          <div className="w-full max-w-2xl mx-auto mb-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-2xl shadow-md border border-slate-300/80 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 transition-all">
              <div className="flex-1 relative flex items-center">
                <label htmlFor="home-search" className="sr-only">Pesquisar serviços</label>
                <Search aria-hidden="true" className="absolute left-3.5 text-slate-400 w-5 h-5 pointer-events-none" />
                <input 
                  id="home-search"
                  name="q"
                  type="text" 
                  placeholder="Ex: Eletricista, Encanador, Pintura, Faxina..." 
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border-none focus:outline-none text-slate-900 placeholder-slate-400 text-sm md:text-base font-normal bg-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Pesquisar serviços"
                />
              </div>
              <button 
                type="submit"
                aria-label="Pesquisar serviços"
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center text-sm md:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Buscar serviços
              </button>
            </form>

            {/* Chips de Categorias Populares */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-600">Populares:</span>
              {[
                { label: 'Eletricista', id: 'electrician' },
                { label: 'Encanador', id: 'plumber' },
                { label: 'Pintor', id: 'painter' },
                { label: 'Faxina', id: 'cleaning' },
                { label: 'Montador', id: 'assembly' }
              ].map(chip => (
                <Link
                  key={chip.id}
                  to={`/categoria/${chip.id}`}
                  className="bg-white hover:bg-brand-50 text-slate-700 hover:text-brand-700 px-2.5 py-1 rounded-md border border-slate-200/90 hover:border-brand-300 transition-colors"
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Selos de Confiança */}
          <div className="flex flex-wrap justify-center gap-y-2 gap-x-6 text-slate-600 text-xs sm:text-sm font-medium pt-2">
            <span className="inline-flex items-center"><CheckCircle2 size={16} className="mr-1.5 text-emerald-600" /> Sem taxas de agenciamento</span>
            <span className="inline-flex items-center"><CheckCircle2 size={16} className="mr-1.5 text-emerald-600" /> WhatsApp Direto</span>
            <span className="inline-flex items-center"><CheckCircle2 size={16} className="mr-1.5 text-emerald-600" /> Avaliações Reais de Clientes</span>
          </div>
        </div>
      </section>

      {/* Categorias: Grid Estruturado com Cards Acolhedores */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Explore por categoria</h2>
              <p className="text-slate-500 text-sm">Selecione uma especialidade para ver profissionais disponíveis</p>
            </div>
            <Link to="/search" className="text-sm font-semibold text-brand-600 hover:text-brand-700 hidden sm:inline-flex items-center">
              Ver todas <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {options.filter(c => c.id !== 'all').map(cat => (
              <Link 
                key={cat.id} 
                to={`/categoria/${cat.id}`}
                className="group flex flex-col items-center justify-center p-3.5 bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/70 hover:border-brand-400 hover:shadow-sm transition-all duration-200 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-white text-brand-600 group-hover:bg-brand-600 group-hover:text-white flex items-center justify-center mb-2.5 shadow-2xs border border-slate-200/60 group-hover:border-transparent transition-all duration-200">
                  {categoryIcon(cat.id)}
                </div>
                <h3 className="font-semibold text-slate-800 text-xs md:text-sm leading-snug group-hover:text-brand-600 transition-colors">
                  {cat.label}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Serviços em Destaque */}
      <section id="featured-services" aria-labelledby="featured-heading" className="py-14 md:py-16 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wider mb-1">
                <Sparkles size={13} className="text-brand-500" /> Profissionais Recomendados
              </div>
              <h2 id="featured-heading" className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Serviços em destaque</h2>
              <p className="text-slate-500 mt-1 text-sm">Prestadores bem avaliados prontos para te atender.</p>
            </div>
            <Link 
              to="/search" 
              className="group text-slate-700 font-semibold flex items-center hover:text-brand-600 bg-white px-4 py-2 rounded-xl shadow-2xs border border-slate-200/80 hover:border-brand-300 transition-all text-sm active:scale-95"
            >
              Ver todos os serviços <ArrowRight size={16} className="ml-1.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-80 bg-slate-200/80 rounded-2xl"></div>
              ))}
            </div>
          ) : featuredAds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredAds.slice(0, 8).map(ad => (
                <div key={ad.id} className="h-full">
                  <ServiceCard ad={ad} compact />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-600 mx-auto flex items-center justify-center mb-3">
                <Search size={22} />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">Nenhum anúncio publicado ainda</h3>
              <p className="text-sm text-slate-500 mb-5">Seja o primeiro prestador a divulgar seus serviços na sua região.</p>
              <Link 
                to="/create-ad" 
                className="inline-flex items-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl text-sm transition-colors"
              >
                Cadastrar primeiro anúncio
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Como o Mestrio Funciona: Design Claro, Humano e Sem Clichês */}
      <section className="py-16 md:py-20 bg-white border-t border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-3">Transparência do início ao fim</h2>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              O Mestrio não cobra comissões nem retém dinheiro. A contratação é direta entre você e o profissional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold text-lg flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Busca Direcionada</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Filtre por especialidade, localização e disponibilidade para encontrar quem realmente atende perto da sua casa.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold text-lg flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Contato sem Intermediários</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Converse por chat interno ou vá direto para o WhatsApp do profissional. Você combina prazos e valores com liberdade total.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold text-lg flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Avaliações Auditadas</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Consulte o histórico e depoimentos de quem já contratou. Após o serviço, deixe sua avaliação para fortalecer os melhores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Chamada para Ação para Prestadores e Clientes */}
      <section className="py-12 md:py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 rounded-3xl p-8 md:p-14 text-white relative overflow-hidden shadow-xl border border-slate-800">
            <div className="max-w-3xl relative z-10">
              <span className="inline-block text-xs font-bold text-brand-300 uppercase tracking-wider mb-3">
                Para Prestadores Autônomos
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4 leading-snug">
                Divulgue seu trabalho e conquiste novos clientes todos os dias.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base mb-8 max-w-2xl leading-relaxed font-normal">
                Cadastre seus serviços gratuitamente, mostre fotos dos seus trabalhos anteriores e receba pedidos de orçamento diretamente no seu WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row gap-3.5">
                <Link 
                  to="/create-ad" 
                  className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-3.5 rounded-xl text-center text-sm md:text-base shadow-md transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  Criar meu anúncio gratuito
                </Link>
                <Link 
                  to="/login" 
                  className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white font-semibold px-6 py-3.5 rounded-xl text-center text-sm md:text-base border border-slate-700 transition-all active:scale-[0.98]"
                >
                  Entrar na minha conta
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
