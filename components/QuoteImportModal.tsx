import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Sparkles, X, CheckCircle, AlertCircle, ClipboardPaste, ArrowRight } from 'lucide-react';
import { DetailedQuote } from '../types';
import { parseQuoteFromFile, parseQuoteFromText } from '../utils/quoteDocument';
import { useToast } from '../context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (quoteData: Partial<DetailedQuote>) => void;
}

export const QuoteImportModal: React.FC<Props> = ({ isOpen, onClose, onImportSuccess }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const parsed = await parseQuoteFromFile(file);
      onImportSuccess(parsed);
      toast(`Orçamento importado com sucesso a partir de "${file.name}"!`, 'success');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast('Não foi possível extrair os dados do arquivo. Tente colar o texto diretamente.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleProcessText = () => {
    if (!pastedText.trim()) {
      toast('Cole o texto do orçamento antes de continuar.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = parseQuoteFromText(pastedText);
      onImportSuccess(parsed);
      toast('Dados extraídos e preenchidos no formulário!', 'success');
      onClose();
    } catch (err) {
      toast('Erro ao processar o texto informado.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-gray-100 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Importar Orçamento</h3>
              <p className="text-xs text-gray-500">Importe arquivos Word (.docx), JSON ou anotações em texto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold text-gray-600">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'file' ? 'bg-white text-brand-700 shadow-xs' : 'hover:text-gray-900'
            }`}
          >
            <FileText size={15} /> Arquivo (.docx / .json / .txt)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'text' ? 'bg-white text-brand-700 shadow-xs' : 'hover:text-gray-900'
            }`}
          >
            <ClipboardPaste size={15} /> Colar Texto / WhatsApp
          </button>
        </div>

        {/* Tab 1: Upload de Arquivo */}
        {activeTab === 'file' && (
          <div className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-brand-500 bg-brand-50/50 scale-[1.01]'
                  : 'border-gray-300 hover:border-brand-400 bg-gray-50/50 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.json,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="p-4 bg-white rounded-2xl shadow-xs border border-gray-200 text-brand-600">
                <UploadCloud size={32} />
              </div>

              <div>
                <p className="text-sm font-bold text-gray-800">
                  Clique para selecionar ou arraste o arquivo aqui
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Formatos suportados: <strong>DOCX (Word)</strong>, <strong>JSON (Backup)</strong> e <strong>TXT</strong>
                </p>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-brand-600 border-t-transparent"></span>
                  Lendo e estruturando documento...
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle size={14} className="text-blue-600" />
                Extração Automática de Dados
              </p>
              <p className="text-blue-700">
                O sistema lê tabelas de itens, descrições, quantidades, preços unitários, dados do cliente e condições comerciais para preenchimento imediato.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Colar Texto */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Cole a mensagem do WhatsApp, rascunho ou orçamento em texto:
              </label>
              <textarea
                rows={7}
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={`Exemplo:\nCliente: Mariana Lima\nTelefone: (11) 98888-7777\nServiço: Troca de disjuntor geral\n1. Mão de obra elétrica - R$ 250\n2. Disjuntor bipolar 40A - R$ 45\nPrazo: 1 dia\nPagamento: 50% no início e 50% no término`}
                className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessText}
                disabled={isProcessing || !pastedText.trim()}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? 'Processando...' : 'Converter em Orçamento'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
