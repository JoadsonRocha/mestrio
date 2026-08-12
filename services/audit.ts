type AuditLevel = 'info' | 'warn' | 'error';

interface AuditEntry {
  level: AuditLevel;
  action: string;
  message: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

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

export function logSecurityEvent(action: string, message: string, metadata?: Record<string, unknown>, userId?: string) {
  const entry = buildEntry('info', action, message, metadata, userId);
  console.info('[SECURITY]', JSON.stringify(entry));
}

export function logSecurityWarning(action: string, message: string, metadata?: Record<string, unknown>, userId?: string) {
  const entry = buildEntry('warn', action, message, metadata, userId);
  console.warn('[SECURITY]', JSON.stringify(entry));
}

export function logSecurityError(action: string, message: string, metadata?: Record<string, unknown>, userId?: string) {
  const entry = buildEntry('error', action, message, metadata, userId);
  console.error('[SECURITY]', JSON.stringify(entry));
}
