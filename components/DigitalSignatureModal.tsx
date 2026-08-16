import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw, Check, X, Shield, Lock } from 'lucide-react';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureBase64: string, signerRole: 'provider' | 'client') => void;
  signerName: string;
  signerRole: 'provider' | 'client';
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  signerName,
  signerRole,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setHasDrawn(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Set canvas resolution
        canvas.width = 500;
        canvas.height = 200;
        ctx.strokeStyle = '#1e3a8a'; // Dark blue ink
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl, signerRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <PenTool size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Assinatura Digital Eletrônica</h3>
              <p className="text-xs text-slate-300">
                {signerRole === 'provider' ? 'Assinatura do Prestador' : 'Aprovação do Cliente'}: <strong>{signerName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Canvas */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1 text-slate-600 font-medium">
              <Lock size={12} className="text-emerald-600" /> Desenhe sua rubrica no espaço abaixo (Dedo ou Mouse):
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 transition"
            >
              <RotateCcw size={12} /> Limpar
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/60 relative overflow-hidden flex items-center justify-center touch-none">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 cursor-crosshair"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-gray-400 text-xs">
                <PenTool size={24} className="mb-1 opacity-40 text-blue-500" />
                <span>Assine aqui</span>
              </div>
            )}
            <div className="absolute bottom-2 left-4 right-4 border-b border-gray-300 pointer-events-none"></div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
            <Shield size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900 leading-relaxed">
              Esta assinatura será vinculada com carimbo de data e hora ao documento PDF oficial do orçamento ou termo de quitação conforme validade eletrônica nacional.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasDrawn}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Check size={14} /> Aplicar Assinatura
          </button>
        </div>

      </div>
    </div>
  );
};
