import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, MapPin, Trash2, ExternalLink } from 'lucide-react';
import { store } from '../services/store';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ServiceAd } from '../types';

export const FavoritesTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<ServiceAd[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await store.getFavorites(user.id);
      setFavorites(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [user]);

  const handleRemove = async (adId: string) => {
    if (!user) return;
    await store.toggleFavorite(user.id, adId);
    setFavorites(prev => prev.filter(a => a.id !== adId));
    toast('Removido dos favoritos.', 'info');
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhum favorito salvo</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
          Você pode salvar anúncios de serviços e profissionais favoritos clicando no ícone de coração enquanto navega pela plataforma.
        </p>
        <Link
          to="/search"
          className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition font-medium text-sm"
        >
          Explorar Serviços
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Heart size={20} className="text-red-500 mr-2 fill-current" />
          Meus Anúncios Salvos ({favorites.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {favorites.map((ad) => (
          <div
            key={ad.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="relative h-40 bg-gray-100 overflow-hidden">
                <img
                  src={ad.images[0] || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=500&q=80'}
                  alt={ad.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemove(ad.id)}
                  title="Remover dos favoritos"
                  className="absolute top-2 right-2 p-2 bg-white/90 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition shadow"
                >
                  <Trash2 size={16} />
                </button>
                {ad.isPremium && (
                  <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded shadow">
                    Destaque
                  </span>
                )}
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-brand-600 font-semibold">
                  <span>{ad.category}</span>
                  <div className="flex items-center text-amber-500">
                    <Star size={12} className="fill-current mr-1" />
                    <span>{ad.rating.toFixed(1)} ({ad.reviewCount})</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{ad.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{ad.description}</p>

                <div className="flex items-center text-xs text-gray-500 pt-1">
                  <MapPin size={12} className="mr-1 shrink-0" />
                  <span className="truncate">{ad.location}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <span className="text-xs text-gray-400">A partir de</span>
                <p className="text-sm font-bold text-gray-900">
                  R$ {ad.price.toLocaleString('pt-BR')} <span className="text-xs font-normal text-gray-500">/{ad.priceUnit === 'hour' ? 'h' : 'serviço'}</span>
                </p>
              </div>

              <Link
                to={`/service/${ad.id}`}
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 border border-brand-200 bg-white px-3 py-1.5 rounded-md hover:bg-brand-50 transition"
              >
                Ver Detalhes <ExternalLink size={12} className="ml-1" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
