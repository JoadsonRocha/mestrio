import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, MoveHorizontal } from 'lucide-react';
import { BeforeAfterProject } from '../types';

interface BeforeAfterSliderProps {
  project: BeforeAfterProject;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ project }) => {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 to 100)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <Sparkles size={15} className="text-amber-500" /> {project.title}
          </h4>
          {project.description && (
            <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>
          )}
        </div>
        {project.category && (
          <span className="text-[10px] font-bold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-200">
            {project.category}
          </span>
        )}
      </div>

      {/* Container do Slider de Imagens */}
      <div
        ref={containerRef}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        className="relative h-64 sm:h-72 w-full rounded-xl overflow-hidden select-none cursor-ew-resize bg-gray-100 shadow-inner"
      >
        {/* Imagem do "DEPOIS" (Fundo Completo) */}
        <img
          src={project.afterImage}
          alt="Depois da Execução"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        <div className="absolute top-3 right-3 bg-emerald-600/90 text-white text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-xs shadow-md uppercase tracking-wider">
          Depois
        </div>

        {/* Imagem do "ANTES" (Sobreposta e cortada pelo clip-path) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={project.beforeImage}
            alt="Antes da Execução"
            className="absolute inset-0 w-full h-full object-cover max-w-none"
            style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
          />
          <div className="absolute top-3 left-3 bg-slate-900/90 text-white text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-xs shadow-md uppercase tracking-wider">
            Antes
          </div>
        </div>

        {/* Linha Divisória e Alça de Arrasto */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-slate-900 shadow-xl flex items-center justify-center border-2 border-brand-600">
            <MoveHorizontal size={16} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
        <span>Arraste o cursor para comparar o resultado</span>
        {project.date && <span>Realizado em {project.date}</span>}
      </div>
    </div>
  );
};
