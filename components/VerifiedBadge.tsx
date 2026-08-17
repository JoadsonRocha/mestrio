import React from 'react';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  className?: string;
  showText?: boolean;
  text?: string;
  tooltip?: string;
}

/**
 * VerifiedBadge - Selo de verificação azul oficial estilo Instagram / Meta / Twitter.
 * Possui formato de roseta octogonal estilizada com check branco centralizado e gradiente azul vibrante (#0095f6 a #1877f2).
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 'sm',
  className = '',
  showText = false,
  text = 'Verificado',
  tooltip = 'Profissional Verificado & Documentado',
}) => {
  const getDimension = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs':
        return 13;
      case 'sm':
        return 16;
      case 'md':
        return 20;
      case 'lg':
        return 24;
      default:
        return 16;
    }
  };

  const dim = getDimension();

  const badgeIcon = (
    <span title={tooltip} className="inline-flex items-center justify-center shrink-0">
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 inline-block drop-shadow-2xs select-none ${className}`}
        aria-label={tooltip}
      >
        <defs>
          <linearGradient id="igVerifiedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0095f6" />
            <stop offset="50%" stopColor="#1877f2" />
            <stop offset="100%" stopColor="#0c63e4" />
          </linearGradient>
        </defs>
        
        {/* Roseta de 8 pontas estilo Instagram */}
        <path
          d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.438-1.53-.023-3.21-1.229-4.14-1.206-.93-2.885-.86-4.015.17-1.13-1.03-2.809-1.1-4.015-.17-1.206.93-1.667 2.61-1.229 4.14C8.635 9.55 7.76 10.92 7.76 12.5s.875 2.95 2.148 3.6c-.438 1.53.023 3.21 1.229 4.14 1.206.93 2.885.86 4.015-.17 1.13 1.03 2.809 1.1 4.015.17 1.206-.93 1.667-2.61 1.229-4.14 1.273-.65 2.148-2.02 2.148-3.6z"
          transform="translate(-3.1, -1.8) scale(1.26)"
          fill="url(#igVerifiedGrad)"
        />
        
        {/* Check centralizado branco */}
        <path
          d="M10.2 16.2l-3.8-3.8 1.4-1.4 2.4 2.4 6.2-6.2 1.4 1.4z"
          fill="#ffffff"
        />
      </svg>
    </span>
  );

  if (showText) {
    return (
      <span
        title={tooltip}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-bold tracking-tight shadow-2xs"
      >
        {badgeIcon}
        <span>{text}</span>
      </span>
    );
  }

  return badgeIcon;
};

export default VerifiedBadge;
