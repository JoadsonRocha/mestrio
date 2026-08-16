/**
 * Níveis de auditoria suportados para registro de eventos.
 * - 'info': Eventos informativos normais.
 * - 'warn': Avisos que podem requerer atenção.
 * - 'error': Erros críticos de segurança ou sistema.
 */
type AuditLevel = 'info' | 'warn' | 'error';

/**
 * Estrutura de dados que representa uma entrada de auditoria.
 */
interface AuditEntry {
  /** Nível de severidade do evento */
  level: AuditLevel;
  /** Ação específica que desencadeou o evento (ex: 'LOGIN', 'DATA_EXPORT') */
  action: string;
  /** Mensagem descritiva do evento */
  message: string;
  /** Data e hora do evento em formato ISO 8601 */
  timestamp: string;
  /** ID do usuário relacionado ao evento (opcional) */
  userId?: string;
  /** Dados adicionais relevantes para o contexto do evento (opcional) */
  metadata?: Record<string, unknown>;
}

/**
 * Função utilitária para construir um objeto de entrada de auditoria padronizado.
 * 
 * @param level - Nível de severidade (info, warn, error).
 * @param action - Nome da ação realizada.
 * @param message - Mensagem detalhada do evento.
 * @param metadata - Dados adicionais de contexto (opcional).
 * @param userId - ID do usuário associado à ação (opcional).
 * @returns Um objeto `AuditEntry` devidamente formatado.
 */
function buildEntry(level: AuditLevel, action: string, message: string, metadata?: Record<string, unknown>, userId?: string): AuditEntry {
  return {
    level,
    action,
    message,
    timestamp: new Date().toISOString(),
    userId,
    metadata,
  };
}

/**
 * Registra um evento de segurança de nível informativo (info).
 * Utilizado para ações bem-sucedidas ou eventos de rotina que precisam ser auditados.
 * 
 * @param action - Nome da ação realizada.
 * @param message - Mensagem descritiva.
 * @param metadata - Dados adicionais de contexto (opcional).
 * @param userId - ID do usuário associado à ação (opcional).
 */
export function logSecurityEvent(action: string, message: string, metadata?: Record<string, unknown>, userId?: string) {
  const entry = buildEntry('info', action, message, metadata, userId);
  console.info('[SECURITY]', JSON.stringify(entry));
}

/**
 * Registra um evento de segurança de nível de aviso (warn).
 * Utilizado para comportamentos suspeitos ou falhas não críticas.
 * 
 * @param action - Nome da ação realizada.
 * @param message - Mensagem descritiva do aviso.
 * @param metadata - Dados adicionais de contexto (opcional).
 * @param userId - ID do usuário associado à ação (opcional).
 */
export function logSecurityWarning(action: string, message: string, metadata?: Record<string, unknown>, userId?: string) {
  const entry = buildEntry('warn', action, message, metadata, userId);
  console.warn('[SECURITY]', JSON.stringify(entry));
}

/**
 * Registra um erro de segurança crítico (error).
 * Utilizado para falhas graves, violações de permissão ou exceções capturadas.
 * 
 * @param action - Nome da ação realizada.
 * @param message - Mensagem descritiva do erro.
 * @param metadata - Dados adicionais de contexto (opcional).
 * @param userId - ID do usuário associado à ação (opcional).
 */
export function logSecurityError(action: string, message: string, metadata?: Record<string, unknown>, userId?: string) {
  const entry = buildEntry('error', action, message, metadata, userId);
  console.error('[SECURITY]', JSON.stringify(entry));
}
