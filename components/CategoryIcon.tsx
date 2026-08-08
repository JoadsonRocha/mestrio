import React from 'react';
import { Zap, Droplets, Paintbrush, Brush, Wrench, Truck, Leaf, Package, ArrowRight } from 'lucide-react';

export function categoryIcon(id: string, size = 20): React.ReactNode {
  switch (id) {
    case 'electrician': return <Zap size={size} />;
    case 'plumber': return <Droplets size={size} />;
    case 'painter': return <Paintbrush size={size} />;
    case 'cleaning': return <Brush size={size} />;
    case 'handyman': return <Wrench size={size} />;
    case 'moving': return <Truck size={size} />;
    case 'gardener': return <Leaf size={size} />;
    case 'assembly': return <Package size={size} />;
    default: return <ArrowRight size={size} />;
  }
}
