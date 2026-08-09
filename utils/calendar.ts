import { Appointment } from '../types';

export const generateGoogleCalendarUrl = (app: Appointment): string => {
  if (!app.date || !app.time) return '#';
  
  try {
    const [year, month, day] = app.date.split('-');
    const [hours, minutes] = app.time.split(':');
    
    const startDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Assumindo duração de 1h como padrão
    
    // Formato Google (ex: 20240125T140000Z)
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    };

    const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;
    const text = encodeURIComponent(`Serviço: ${app.adTitle || 'Mestrio'}`);
    const details = encodeURIComponent(`Agendamento via Mestrio.\n\nCliente: ${app.clientName || 'Cliente'}\nNotas: ${app.notes || 'Sem observações.'}`);
    const location = encodeURIComponent(app.clientLocation || '');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  } catch (error) {
    console.error('Error generating Google Calendar URL:', error);
    return '#';
  }
};
