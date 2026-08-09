import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ServiceAd } from '../types';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

// Fix Leaflet icons issue in React (Webpack/Vite issue)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  ads: ServiceAd[];
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export const MapView: React.FC<MapViewProps> = ({ ads }) => {
  const navigate = useNavigate();
  // Filter ads that have valid lat and lng
  const mapAds = ads.filter(ad => typeof ad.lat === 'number' && typeof ad.lng === 'number');

  const defaultCenter: [number, number] = [-15.7801, -47.9292]; // Brasilia
  const center: [number, number] = mapAds.length > 0 
    ? [mapAds[0].lat!, mapAds[0].lng!] 
    : defaultCenter;

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-sm border border-gray-200 relative" style={{ zIndex: 0 }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={center} zoom={mapAds.length > 0 ? 12 : 4} />
        {mapAds.map(ad => (
          <Marker key={ad.id} position={[ad.lat!, ad.lng!]}>
            <Popup>
              <div className="text-sm font-sans min-w-[200px]">
                <div className="font-bold text-base text-gray-900 leading-tight mb-1">{ad.title}</div>
                <div className="text-gray-600 mb-2">{ad.providerName}</div>
                <div className="font-semibold text-green-700 mb-3">
                  R$ {ad.price.toFixed(2)} {ad.priceUnit === 'hour' ? '/h' : ''}
                </div>
                <button 
                  onClick={() => navigate(`/service/${ad.id}`)}
                  className="bg-brand-600 text-white w-full py-2 rounded-md font-bold text-center block transition-colors hover:bg-brand-700"
                >
                  Ver Detalhes
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
