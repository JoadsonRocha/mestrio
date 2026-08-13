import React from 'react';
import {
  Zap, Droplets, Paintbrush, Brush, Wrench, Truck, Leaf, Package, ArrowRight,
  Hammer, Cog, Plug, Drill, Sparkles, Scissors, Sofa, Laptop, Bike, KeyRound, Wifi, ShowerHead,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Mapa que aceita tanto o slug legado (ex: "electrician") quanto o nome do
// ícone escolhido na criação da categoria no painel (ex: "Hammer").
const ICONS: Record<string, LucideIcon> = {
  electrician: Zap,
  plumber: Droplets,
  painter: Paintbrush,
  cleaning: Brush,
  handyman: Wrench,
  moving: Truck,
  gardener: Leaf,
  assembly: Package,
  Zap, Droplets, Paintbrush, Brush, Wrench, Truck, Leaf, Package,
  Hammer, Cog, Plug, Drill, Sparkles, Scissors, Sofa, Laptop, Bike, KeyRound, Wifi, ShowerHead,
};

export function categoryIcon(id: string, size = 20): React.ReactNode {
  const Icon = ICONS[id] || ArrowRight;
  return <Icon size={size} />;
}