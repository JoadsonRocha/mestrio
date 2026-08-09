const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 5;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export function validatePassword(password: string): { valid: boolean; message?: string } {
  const value = password.trim();

  if (value.length < 8) {
    return { valid: false, message: 'A senha precisa ter no mínimo 8 caracteres.' };
  }
  if (!/[A-Z]/.test(value)) {
    return { valid: false, message: 'A senha precisa incluir pelo menos uma letra maiúscula.' };
  }
  if (!/\d/.test(value)) {
    return { valid: false, message: 'A senha precisa incluir pelo menos um número.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
    return { valid: false, message: 'A senha precisa incluir pelo menos um caractere especial.' };
  }

  return { valid: true };
}

export function validateEmail(email: string): { valid: boolean; message?: string } {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, message: 'Informe um e-mail.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, message: 'Formato de e-mail inválido.' };
  }
  return { valid: true };
}

export function validateUploadCount(currentCount: number, incomingFiles: File[]): { valid: boolean; message?: string } {
  if (currentCount + incomingFiles.length > MAX_FILES_PER_UPLOAD) {
    return { valid: false, message: `Você pode enviar até ${MAX_FILES_PER_UPLOAD} imagens por anúncio.` };
  }
  return { valid: true };
}

export async function validateUploadFileContent(file: File): Promise<{ valid: boolean; message?: string }> {
  if (!file) {
    return { valid: false, message: 'Arquivo inválido.' };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { valid: false, message: 'O arquivo excede o limite de 5 MB.' };
  }

  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { valid: false, message: 'Formato de imagem não suportado.' };
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, message: 'Tipo de arquivo não permitido.' };
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 512));
  const header = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toLowerCase();
  const textChunk = new TextDecoder('utf-8', { fatal: false }).decode(bytes).toLowerCase();

  const suspiciousPatterns = ['<script', 'javascript:', 'onerror=', '<svg', 'data:text/html', '<!doctype html'];
  if (suspiciousPatterns.some((pattern) => textChunk.includes(pattern))) {
    return { valid: false, message: 'Arquivo suspeito ou malicioso.' };
  }

  const isPng = header.startsWith('89504e470d0a1a0a');
  const isJpeg = header.startsWith('ffd8ff');
  const isGif = header.startsWith('47494638');
  const isWebp = header.startsWith('52494646') && header.includes('57454250');
  const isAvif = header.includes('66747970617669');

  const isKnownImage = isPng || isJpeg || isGif || isWebp || isAvif;
  if (!isKnownImage) {
    return { valid: false, message: 'O conteúdo do arquivo não corresponde a uma imagem válida.' };
  }

  return { valid: true };
}
