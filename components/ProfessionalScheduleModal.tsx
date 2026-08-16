import React, { useEffect, useState } from 'react';
import { Clock, Calendar, X, Save, Check } from 'lucide-react';
import { store } from '../services/store';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ProfessionalSchedule } from '../types';

/**
 * Propriedades para o modal de grade de horários.
 */
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const WEEKDAYS: { id: string; label: string }[] = [
  { id: 'mon', label: 'Seg' },
  { id: 'tue', label: 'Ter' },
  { id: 'wed', label: 'Qua' },
  { id: 'thu', label: 'Qui' },
  { id: 'fri', label: 'Sex' },
  { id: 'sat', label: 'Sáb' },
  { id: 'dom', label: 'Dom' },
  { id: 'emergency', label: 'Emergências' },
  { id: '24h', label: '24h' },
];

/**
 * Modal que permite ao prestador de serviços configurar sua disponibilidade semanal.
 * Define dias de trabalho, horários de início/fim e intervalos de almoço.
 */
export const ProfessionalScheduleModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schedule, setSchedule] = useState<ProfessionalSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !isOpen) return;
    setLoading(true);
    store.getProfessionalSchedule(user.id).then(data => {
      setSchedule(data);
      setLoading(false);
    });
  }, [user, isOpen]);

  if (!isOpen || !schedule) return null;

  const toggleDay = (dayId: string) => {
    if (!schedule) return;
    const exists = schedule.workDays.includes(dayId);
    const newDays = exists
      ? schedule.workDays.filter(d => d !== dayId)
      : [...schedule.workDays, dayId];
    setSchedule({ ...schedule, workDays: newDays });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;
    setSaving(true);
    try {
      await store.saveProfessionalSchedule(schedule);
      toast('Grade de horários atualizada com sucesso!', 'success');
      onClose();
    } catch (e) {
      console.error(e);
      toast('Erro ao salvar horários.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-gray-900 text-base flex items-center">
            <Clock size={18} className="text-brand-600 mr-2" />
            Configurar Disponibilidade de Atendimento
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-500">Carregando horários...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Dias de Atendimento na Semana</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => {
                  const active = schedule.workDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        active
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Horário Inicial</label>
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={e => setSchedule({ ...schedule, startTime: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Horário Final</label>
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={e => setSchedule({ ...schedule, endTime: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <label className="block text-xs font-semibold text-gray-700">Intervalo / Almoço (Opcional)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-gray-500 block mb-0.5">Início do Almoço</span>
                  <input
                    type="time"
                    value={schedule.breakStart || '12:00'}
                    onChange={e => setSchedule({ ...schedule, breakStart: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-gray-500 block mb-0.5">Fim do Almoço</span>
                  <input
                    type="time"
                    value={schedule.breakEnd || '13:00'}
                    onChange={e => setSchedule({ ...schedule, breakEnd: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                id="autoApprove"
                checked={schedule.autoApprove || false}
                onChange={e => setSchedule({ ...schedule, autoApprove: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
              />
              <label htmlFor="autoApprove" className="text-xs text-gray-700 font-medium">
                Aprovação automática de agendamentos dentro da grade
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-semibold disabled:opacity-50 inline-flex items-center"
              >
                <Save size={14} className="mr-1.5" />
                {saving ? 'Salvando...' : 'Salvar Disponibilidade'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
