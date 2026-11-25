import React from 'react';

export interface PixelIconProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Four 2px antique-gold/bronze corner pixel rivets matching the 16-bit HUD plaque.
 * Place inside any `relative` panel frame.
 */
export const PixelRivets: React.FC<{ className?: string }> = ({ className = '' }) => (
  <>
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-[3px] top-[3px] z-10 h-[2px] w-[2px] bg-[var(--px-rivet)] ${className}`}
    />
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute right-[3px] top-[3px] z-10 h-[2px] w-[2px] bg-[var(--px-rivet)] ${className}`}
    />
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-[3px] left-[3px] z-10 h-[2px] w-[2px] bg-[var(--px-rivet)] ${className}`}
    />
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-[3px] right-[3px] z-10 h-[2px] w-[2px] bg-[var(--px-rivet)] ${className}`}
    />
  </>
);

const svgProps = (size: number, className = '') => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  shapeRendering: 'crispEdges' as const,
  className: `pixel-art shrink-0 ${className}`.trim(),
  'aria-hidden': true as const,
});

// ==================== NAVIGATION & RPG CORE ====================

export const PxScroll: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="3" y="1" width="10" height="2" fill={color} />
    <rect x="2" y="2" width="2" height="2" fill={color} />
    <rect x="12" y="2" width="2" height="2" fill={color} />
    <rect x="3" y="3" width="9" height="10" fill={color} opacity="0.22" />
    <rect x="3" y="3" width="1" height="10" fill={color} />
    <rect x="12" y="3" width="1" height="10" fill={color} />
    <rect x="5" y="5" width="6" height="1" fill={color} />
    <rect x="5" y="7" width="6" height="1" fill={color} />
    <rect x="5" y="9" width="4" height="1" fill={color} />
    <rect x="2" y="12" width="2" height="2" fill={color} />
    <rect x="12" y="12" width="2" height="2" fill={color} />
    <rect x="3" y="13" width="10" height="2" fill={color} />
  </svg>
);

export const PxCalendar: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="1" width="2" height="2" fill={color} />
    <rect x="10" y="1" width="2" height="2" fill={color} />
    <rect x="2" y="3" width="12" height="3" fill={color} />
    <rect x="2" y="6" width="1" height="8" fill={color} />
    <rect x="13" y="6" width="1" height="8" fill={color} />
    <rect x="2" y="13" width="12" height="2" fill={color} />
    <rect x="4" y="7" width="2" height="2" fill={color} />
    <rect x="7" y="7" width="2" height="2" fill={color} />
    <rect x="10" y="7" width="2" height="2" fill={color} />
    <rect x="4" y="10" width="2" height="2" fill={color} />
    <rect x="7" y="10" width="2" height="2" fill="var(--px-gold)" />
  </svg>
);

export const PxSkillTree: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="6" y="1" width="4" height="3" fill="var(--px-gold)" />
    <rect x="7" y="4" width="2" height="3" fill={color} />
    <rect x="3" y="6" width="10" height="2" fill={color} />
    <rect x="3" y="8" width="2" height="2" fill={color} />
    <rect x="11" y="8" width="2" height="2" fill={color} />
    <rect x="2" y="10" width="4" height="4" fill={color} />
    <rect x="10" y="10" width="4" height="4" fill={color} />
    <rect x="7" y="8" width="2" height="4" fill={color} />
    <rect x="6" y="12" width="4" height="3" fill={color} />
  </svg>
);

export const PxShield: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="1" width="12" height="2" fill={color} />
    <rect x="2" y="3" width="2" height="6" fill={color} />
    <rect x="12" y="3" width="2" height="6" fill={color} />
    <rect x="4" y="3" width="8" height="6" fill={color} opacity="0.25" />
    <rect x="7" y="4" width="2" height="7" fill={color} />
    <rect x="5" y="6" width="6" height="2" fill={color} />
    <rect x="3" y="9" width="2" height="2" fill={color} />
    <rect x="11" y="9" width="2" height="2" fill={color} />
    <rect x="5" y="11" width="2" height="2" fill={color} />
    <rect x="9" y="11" width="2" height="2" fill={color} />
    <rect x="7" y="13" width="2" height="2" fill={color} />
  </svg>
);

export const PxSkull: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#f1eef9',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="1" width="8" height="2" fill={color} />
    <rect x="2" y="3" width="12" height="6" fill={color} />
    <rect x="3" y="9" width="10" height="2" fill={color} />
    <rect x="4" y="5" width="3" height="3" fill="#09070f" />
    <rect x="9" y="5" width="3" height="3" fill="#09070f" />
    <rect x="7" y="8" width="2" height="2" fill="#09070f" />
    <rect x="4" y="11" width="8" height="3" fill={color} />
    <rect x="5" y="12" width="1" height="2" fill="#09070f" />
    <rect x="8" y="12" width="1" height="2" fill="#09070f" />
    <rect x="10" y="12" width="1" height="2" fill="#09070f" />
  </svg>
);

export const PxAutomaton: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="1" width="2" height="2" fill="var(--px-gold)" />
    <rect x="3" y="3" width="10" height="2" fill={color} />
    <rect x="2" y="5" width="12" height="7" fill={color} opacity="0.24" />
    <rect x="2" y="5" width="2" height="7" fill={color} />
    <rect x="12" y="5" width="2" height="7" fill={color} />
    <rect x="5" y="6" width="2" height="2" fill="var(--px-green-text)" />
    <rect x="9" y="6" width="2" height="2" fill="var(--px-green-text)" />
    <rect x="5" y="10" width="6" height="1" fill={color} />
    <rect x="3" y="12" width="10" height="2" fill={color} />
    <rect x="1" y="7" width="1" height="3" fill={color} />
    <rect x="14" y="7" width="1" height="3" fill={color} />
  </svg>
);

export const PxSword: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#d9e3f0',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="12" y="1" width="3" height="3" fill={color} />
    <rect x="10" y="3" width="3" height="3" fill={color} />
    <rect x="8" y="5" width="3" height="3" fill={color} />
    <rect x="6" y="7" width="3" height="3" fill={color} />
    <rect x="11" y="2" width="2" height="1" fill="#ffffff" />
    <rect x="9" y="4" width="2" height="1" fill="#ffffff" />
    <rect x="7" y="6" width="2" height="1" fill="#ffffff" />
    <rect x="3" y="8" width="2" height="2" fill="#c99330" />
    <rect x="5" y="9" width="2" height="2" fill="#f0c46c" />
    <rect x="6" y="11" width="2" height="2" fill="#c99330" />
    <rect x="2" y="11" width="3" height="3" fill="#7a4f0c" />
    <rect x="1" y="13" width="2" height="2" fill="#f0c46c" />
  </svg>
);

export const PxCrown: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#c99330',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="1" y="4" width="2" height="7" fill={color} />
    <rect x="7" y="2" width="2" height="9" fill="#f0c46c" />
    <rect x="13" y="4" width="2" height="7" fill={color} />
    <rect x="3" y="6" width="2" height="5" fill={color} />
    <rect x="11" y="6" width="2" height="5" fill={color} />
    <rect x="5" y="7" width="6" height="4" fill={color} />
    <rect x="2" y="11" width="12" height="3" fill="#b87e1e" />
    <rect x="7" y="8" width="2" height="2" fill="#b83a4b" />
    <rect x="4" y="12" width="2" height="1" fill="#f5d57a" />
    <rect x="10" y="12" width="2" height="1" fill="#f5d57a" />
  </svg>
);

export const PxBook: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="2" width="11" height="12" fill={color} opacity="0.22" />
    <rect x="2" y="2" width="2" height="12" fill={color} />
    <rect x="4" y="2" width="9" height="2" fill={color} />
    <rect x="12" y="4" width="2" height="9" fill={color} />
    <rect x="4" y="12" width="9" height="2" fill={color} />
    <rect x="6" y="5" width="4" height="2" fill="var(--px-gold)" />
    <rect x="6" y="9" width="4" height="1" fill={color} />
  </svg>
);

export const PxChest: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#a8692c',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="3" width="12" height="4" fill={color} />
    <rect x="1" y="5" width="14" height="8" fill={color} />
    <rect x="1" y="7" width="14" height="2" fill="#c99330" />
    <rect x="6" y="6" width="4" height="4" fill="#f0c46c" />
    <rect x="7" y="7" width="2" height="2" fill="#09070f" />
    <rect x="2" y="12" width="12" height="2" fill="#5e3a16" />
  </svg>
);

export const PxGhost: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#9d76cf',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="1" width="6" height="2" fill={color} />
    <rect x="3" y="3" width="10" height="9" fill={color} />
    <rect x="4" y="5" width="2" height="3" fill="#09070f" />
    <rect x="10" y="5" width="2" height="3" fill="#09070f" />
    <rect x="5" y="5" width="1" height="1" fill="#74ace8" />
    <rect x="11" y="5" width="1" height="1" fill="#74ace8" />
    <rect x="3" y="12" width="2" height="2" fill={color} />
    <rect x="7" y="12" width="2" height="2" fill={color} />
    <rect x="11" y="12" width="2" height="2" fill={color} />
  </svg>
);

export const PxLock: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="2" width="6" height="2" fill={color} />
    <rect x="4" y="4" width="2" height="3" fill={color} />
    <rect x="10" y="4" width="2" height="3" fill={color} />
    <rect x="3" y="7" width="10" height="7" fill={color} />
    <rect x="7" y="9" width="2" height="3" fill="var(--bg-surface)" />
  </svg>
);

// ==================== TOP HUD & ACTIONS ====================

export const PxCoin: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#d4a24c',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="1" width="6" height="2" fill={color} />
    <rect x="3" y="3" width="10" height="10" fill={color} />
    <rect x="5" y="13" width="6" height="2" fill="#9e6d1c" />
    <rect x="5" y="3" width="6" height="2" fill="#f5d57a" />
    <rect x="7" y="5" width="2" height="6" fill="#fff2c2" />
    <rect x="5" y="5" width="2" height="6" fill="#b87e1e" />
  </svg>
);

export const PxGem: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#3b82c4',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="2" width="8" height="2" fill="#74ace8" />
    <rect x="2" y="4" width="12" height="4" fill={color} />
    <rect x="4" y="4" width="4" height="3" fill="#bce0ff" />
    <rect x="4" y="8" width="8" height="3" fill={color} />
    <rect x="6" y="11" width="4" height="2" fill="#29568c" />
    <rect x="7" y="13" width="2" height="2" fill="#1f4878" />
  </svg>
);

export const PxFlame: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#d96426',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="1" width="2" height="2" fill="#f5d57a" />
    <rect x="5" y="3" width="6" height="3" fill="#e68a2e" />
    <rect x="3" y="6" width="10" height="5" fill={color} />
    <rect x="4" y="11" width="8" height="3" fill="#b83a4b" />
    <rect x="6" y="7" width="4" height="4" fill="#f5d57a" />
    <rect x="7" y="9" width="2" height="3" fill="#fff2c2" />
  </svg>
);

export const PxBolt: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#f0c46c',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="8" y="1" width="4" height="2" fill={color} />
    <rect x="6" y="3" width="4" height="2" fill={color} />
    <rect x="4" y="5" width="4" height="2" fill={color} />
    <rect x="3" y="7" width="10" height="2" fill={color} />
    <rect x="6" y="9" width="4" height="2" fill={color} />
    <rect x="5" y="11" width="4" height="2" fill={color} />
    <rect x="4" y="13" width="3" height="2" fill={color} />
  </svg>
);

export const PxSparkle: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#f0c46c',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="1" width="2" height="14" fill={color} />
    <rect x="1" y="7" width="14" height="2" fill={color} />
    <rect x="5" y="5" width="6" height="6" fill={color} />
    <rect x="7" y="6" width="2" height="4" fill="#fff2c2" />
    <rect x="6" y="7" width="4" height="2" fill="#fff2c2" />
  </svg>
);

export const PxEye: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="3" width="8" height="2" fill={color} />
    <rect x="2" y="5" width="2" height="2" fill={color} />
    <rect x="12" y="5" width="2" height="2" fill={color} />
    <rect x="1" y="7" width="2" height="2" fill={color} />
    <rect x="13" y="7" width="2" height="2" fill={color} />
    <rect x="2" y="9" width="2" height="2" fill={color} />
    <rect x="12" y="9" width="2" height="2" fill={color} />
    <rect x="4" y="11" width="8" height="2" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill={color} />
    <rect x="7" y="7" width="1" height="1" fill="#ffffff" />
  </svg>
);

export const PxEyeOff: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="4" width="8" height="2" fill={color} opacity="0.55" />
    <rect x="2" y="6" width="2" height="4" fill={color} opacity="0.55" />
    <rect x="12" y="6" width="2" height="4" fill={color} opacity="0.55" />
    <rect x="4" y="10" width="8" height="2" fill={color} opacity="0.55" />
    <rect x="2" y="2" width="2" height="2" fill={color} />
    <rect x="4" y="4" width="2" height="2" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill={color} />
    <rect x="10" y="10" width="2" height="2" fill={color} />
    <rect x="12" y="12" width="2" height="2" fill={color} />
  </svg>
);

export const PxSoundOn: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="6" width="3" height="4" fill={color} />
    <rect x="5" y="4" width="2" height="8" fill={color} />
    <rect x="7" y="2" width="2" height="12" fill={color} />
    <rect x="11" y="5" width="2" height="6" fill={color} />
    <rect x="13" y="3" width="2" height="2" fill={color} />
    <rect x="14" y="5" width="1" height="6" fill={color} />
    <rect x="13" y="11" width="2" height="2" fill={color} />
  </svg>
);

export const PxSoundOff: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="6" width="3" height="4" fill={color} />
    <rect x="5" y="4" width="2" height="8" fill={color} />
    <rect x="7" y="2" width="2" height="12" fill={color} />
    <rect x="10" y="5" width="2" height="2" fill="var(--px-red-text)" />
    <rect x="14" y="5" width="2" height="2" fill="var(--px-red-text)" />
    <rect x="12" y="7" width="2" height="2" fill="var(--px-red-text)" />
    <rect x="10" y="9" width="2" height="2" fill="var(--px-red-text)" />
    <rect x="14" y="9" width="2" height="2" fill="var(--px-red-text)" />
  </svg>
);

export const PxSun: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#f0c46c',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="1" width="2" height="2" fill={color} />
    <rect x="7" y="13" width="2" height="2" fill={color} />
    <rect x="1" y="7" width="2" height="2" fill={color} />
    <rect x="13" y="7" width="2" height="2" fill={color} />
    <rect x="3" y="3" width="2" height="2" fill={color} />
    <rect x="11" y="3" width="2" height="2" fill={color} />
    <rect x="3" y="11" width="2" height="2" fill={color} />
    <rect x="11" y="11" width="2" height="2" fill={color} />
    <rect x="5" y="5" width="6" height="6" fill={color} />
    <rect x="6" y="6" width="2" height="2" fill="#fff2c2" />
  </svg>
);

export const PxMoon: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#3267a8',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="6" y="2" width="5" height="2" fill={color} />
    <rect x="4" y="4" width="4" height="2" fill={color} />
    <rect x="3" y="6" width="4" height="4" fill={color} />
    <rect x="4" y="10" width="4" height="2" fill={color} />
    <rect x="6" y="12" width="5" height="2" fill={color} />
    <rect x="11" y="11" width="2" height="2" fill={color} />
  </svg>
);

export const PxGear: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="6" y="1" width="4" height="2" fill={color} />
    <rect x="6" y="13" width="4" height="2" fill={color} />
    <rect x="1" y="6" width="2" height="4" fill={color} />
    <rect x="13" y="6" width="2" height="4" fill={color} />
    <rect x="3" y="3" width="2" height="2" fill={color} />
    <rect x="11" y="3" width="2" height="2" fill={color} />
    <rect x="3" y="11" width="2" height="2" fill={color} />
    <rect x="11" y="11" width="2" height="2" fill={color} />
    <rect x="4" y="4" width="8" height="8" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill="var(--bg-surface)" />
  </svg>
);

export const PxReset: React.FC<PixelIconProps> = ({
  size = 16,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="2" width="7" height="2" fill={color} />
    <rect x="3" y="4" width="2" height="2" fill={color} />
    <rect x="2" y="6" width="2" height="4" fill={color} />
    <rect x="3" y="10" width="2" height="2" fill={color} />
    <rect x="5" y="12" width="7" height="2" fill={color} />
    <rect x="12" y="10" width="2" height="2" fill={color} />
    <rect x="11" y="1" width="2" height="5" fill={color} />
    <rect x="9" y="4" width="4" height="2" fill={color} />
  </svg>
);

export const PxCmd: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="2" width="4" height="4" fill={color} />
    <rect x="10" y="2" width="4" height="4" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill={color} />
    <rect x="2" y="10" width="4" height="4" fill={color} />
    <rect x="10" y="10" width="4" height="4" fill={color} />
    <rect x="3" y="3" width="2" height="2" fill="var(--bg-surface)" />
    <rect x="11" y="3" width="2" height="2" fill="var(--bg-surface)" />
    <rect x="3" y="11" width="2" height="2" fill="var(--bg-surface)" />
    <rect x="11" y="11" width="2" height="2" fill="var(--bg-surface)" />
  </svg>
);

export const PxEdit: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="11" y="1" width="3" height="3" fill={color} />
    <rect x="9" y="3" width="3" height="3" fill={color} />
    <rect x="7" y="5" width="3" height="3" fill={color} />
    <rect x="5" y="7" width="3" height="3" fill={color} />
    <rect x="3" y="9" width="3" height="3" fill={color} />
    <rect x="2" y="11" width="3" height="3" fill={color} />
    <rect x="1" y="13" width="2" height="2" fill={color} />
  </svg>
);

export const PxTarget: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#52c484',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="1" width="6" height="2" fill={color} />
    <rect x="5" y="13" width="6" height="2" fill={color} />
    <rect x="1" y="5" width="2" height="6" fill={color} />
    <rect x="13" y="5" width="2" height="6" fill={color} />
    <rect x="3" y="3" width="2" height="2" fill={color} />
    <rect x="11" y="3" width="2" height="2" fill={color} />
    <rect x="3" y="11" width="2" height="2" fill={color} />
    <rect x="11" y="11" width="2" height="2" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill="#c99330" />
  </svg>
);

export const PxWarn: React.FC<PixelIconProps & { danger?: boolean }> = ({
  size = 14,
  danger = false,
  color,
  className,
}) => {
  const fill = color ?? (danger ? '#e86b7a' : '#f0c46c');
  return (
    <svg {...svgProps(size, className)}>
      <rect x="7" y="1" width="2" height="2" fill={fill} />
      <rect x="5" y="3" width="6" height="3" fill={fill} />
      <rect x="3" y="6" width="10" height="4" fill={fill} />
      <rect x="1" y="10" width="14" height="4" fill={fill} />
      <rect x="7" y="5" width="2" height="5" fill="#09070f" />
      <rect x="7" y="11" width="2" height="2" fill="#09070f" />
    </svg>
  );
};

export const PxClock: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="1" width="6" height="2" fill={color} />
    <rect x="5" y="13" width="6" height="2" fill={color} />
    <rect x="1" y="5" width="2" height="6" fill={color} />
    <rect x="13" y="5" width="2" height="6" fill={color} />
    <rect x="3" y="3" width="2" height="2" fill={color} />
    <rect x="11" y="3" width="2" height="2" fill={color} />
    <rect x="3" y="11" width="2" height="2" fill={color} />
    <rect x="11" y="11" width="2" height="2" fill={color} />
    <rect x="7" y="4" width="2" height="5" fill={color} />
    <rect x="8" y="7" width="4" height="2" fill={color} />
  </svg>
);

export const PxBell: React.FC<PixelIconProps & { muted?: boolean }> = ({
  size = 14,
  muted = false,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="1" width="2" height="2" fill={color} />
    <rect x="5" y="3" width="6" height="2" fill={color} />
    <rect x="4" y="5" width="8" height="5" fill={color} />
    <rect x="2" y="10" width="12" height="2" fill={color} />
    <rect x="6" y="13" width="4" height="2" fill={color} />
    {muted && (
      <>
        <rect x="2" y="2" width="2" height="2" fill="#e86b7a" />
        <rect x="4" y="4" width="2" height="2" fill="#e86b7a" />
        <rect x="10" y="10" width="2" height="2" fill="#e86b7a" />
        <rect x="12" y="12" width="2" height="2" fill="#e86b7a" />
      </>
    )}
  </svg>
);

export const PxPlay: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="2" width="2" height="12" fill={color} />
    <rect x="6" y="3" width="2" height="10" fill={color} />
    <rect x="8" y="4" width="2" height="8" fill={color} />
    <rect x="10" y="6" width="2" height="4" fill={color} />
    <rect x="12" y="7" width="1" height="2" fill={color} />
  </svg>
);

export const PxPause: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="3" y="2" width="4" height="12" fill={color} />
    <rect x="9" y="2" width="4" height="12" fill={color} />
  </svg>
);

export const PxCheck: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="8" width="2" height="2" fill={color} />
    <rect x="4" y="10" width="2" height="2" fill={color} />
    <rect x="6" y="8" width="2" height="4" fill={color} />
    <rect x="8" y="6" width="2" height="3" fill={color} />
    <rect x="10" y="4" width="2" height="3" fill={color} />
    <rect x="12" y="2" width="2" height="3" fill={color} />
  </svg>
);

export const PxPlus: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="2" width="2" height="12" fill={color} />
    <rect x="2" y="7" width="12" height="2" fill={color} />
  </svg>
);

export const PxClose: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="2" width="2" height="2" fill={color} />
    <rect x="12" y="2" width="2" height="2" fill={color} />
    <rect x="4" y="4" width="2" height="2" fill={color} />
    <rect x="10" y="4" width="2" height="2" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill={color} />
    <rect x="4" y="10" width="2" height="2" fill={color} />
    <rect x="10" y="10" width="2" height="2" fill={color} />
    <rect x="2" y="12" width="2" height="2" fill={color} />
    <rect x="12" y="12" width="2" height="2" fill={color} />
  </svg>
);

export const PxTrash: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="6" y="1" width="4" height="2" fill={color} />
    <rect x="2" y="3" width="12" height="2" fill={color} />
    <rect x="3" y="5" width="10" height="9" fill={color} opacity="0.25" />
    <rect x="3" y="5" width="2" height="9" fill={color} />
    <rect x="11" y="5" width="2" height="9" fill={color} />
    <rect x="7" y="6" width="2" height="6" fill={color} />
    <rect x="3" y="13" width="10" height="2" fill={color} />
  </svg>
);

export const PxStar: React.FC<PixelIconProps> = ({
  size = 14,
  color = '#f0c46c',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="1" width="2" height="4" fill={color} />
    <rect x="2" y="5" width="12" height="3" fill={color} />
    <rect x="4" y="8" width="8" height="3" fill={color} />
    <rect x="3" y="11" width="3" height="3" fill={color} />
    <rect x="10" y="11" width="3" height="3" fill={color} />
    <rect x="7" y="5" width="2" height="3" fill="#fff2c2" />
  </svg>
);

export const PxCoffee: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="1" width="1" height="3" fill={color} opacity="0.65" />
    <rect x="9" y="1" width="1" height="3" fill={color} opacity="0.65" />
    <rect x="2" y="5" width="9" height="8" fill={color} />
    <rect x="11" y="6" width="3" height="2" fill={color} />
    <rect x="13" y="8" width="1" height="2" fill={color} />
    <rect x="11" y="10" width="3" height="1" fill={color} />
    <rect x="1" y="13" width="12" height="2" fill={color} />
    <rect x="4" y="6" width="5" height="2" fill="#8f5a2b" />
  </svg>
);

export const PxRefresh: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="2" width="7" height="2" fill={color} />
    <rect x="11" y="1" width="2" height="5" fill={color} />
    <rect x="9" y="4" width="4" height="2" fill={color} />
    <rect x="2" y="4" width="2" height="4" fill={color} />
    <rect x="5" y="12" width="7" height="2" fill={color} />
    <rect x="3" y="10" width="2" height="5" fill={color} />
    <rect x="3" y="10" width="4" height="2" fill={color} />
    <rect x="12" y="8" width="2" height="4" fill={color} />
  </svg>
);

export const PxSave: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="2" width="10" height="2" fill={color} />
    <rect x="12" y="4" width="2" height="10" fill={color} />
    <rect x="2" y="4" width="2" height="10" fill={color} />
    <rect x="4" y="12" width="8" height="2" fill={color} />
    <rect x="5" y="2" width="5" height="4" fill={color} opacity="0.5" />
    <rect x="5" y="8" width="6" height="4" fill="var(--px-gold)" />
  </svg>
);

export const PxPhone: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="1" width="8" height="14" fill={color} opacity="0.22" />
    <rect x="4" y="1" width="8" height="2" fill={color} />
    <rect x="4" y="13" width="8" height="2" fill={color} />
    <rect x="4" y="3" width="2" height="10" fill={color} />
    <rect x="10" y="3" width="2" height="10" fill={color} />
    <rect x="7" y="11" width="2" height="1" fill="var(--px-gold)" />
  </svg>
);

export const PxMiniToggle: React.FC<PixelIconProps & { expand?: boolean }> = ({
  size = 14,
  expand = false,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="2" width="12" height="2" fill={color} />
    <rect x="2" y="12" width="12" height="2" fill={color} />
    <rect x="2" y="4" width="2" height="8" fill={color} />
    <rect x="12" y="4" width="2" height="8" fill={color} />
    {expand ? (
      <rect x="5" y="5" width="6" height="6" fill={color} />
    ) : (
      <rect x="8" y="8" width="4" height="4" fill={color} />
    )}
  </svg>
);

export const PxDashboard: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="7" y="2" width="7" height="2" fill={color} />
    <rect x="12" y="4" width="2" height="5" fill={color} />
    <rect x="9" y="5" width="2" height="2" fill={color} />
    <rect x="7" y="7" width="2" height="2" fill={color} />
    <rect x="2" y="4" width="3" height="2" fill={color} />
    <rect x="2" y="6" width="2" height="8" fill={color} />
    <rect x="4" y="12" width="8" height="2" fill={color} />
    <rect x="10" y="10" width="2" height="2" fill={color} />
  </svg>
);

export const PxHide: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="10" width="12" height="3" fill={color} />
  </svg>
);

export const PxSearch: React.FC<PixelIconProps> = ({
  size = 14,
  color = 'currentColor',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="2" width="5" height="2" fill={color} />
    <rect x="2" y="4" width="2" height="5" fill={color} />
    <rect x="9" y="4" width="2" height="5" fill={color} />
    <rect x="4" y="9" width="5" height="2" fill={color} />
    <rect x="10" y="10" width="2" height="2" fill={color} />
    <rect x="12" y="12" width="2" height="2" fill={color} />
  </svg>
);

export const PxChevron: React.FC<
  PixelIconProps & { dir?: 'left' | 'right' | 'up' | 'down' }
> = ({ size = 14, dir = 'right', color = 'currentColor', className }) => {
  if (dir === 'left') {
    return (
      <svg {...svgProps(size, className)}>
        <rect x="9" y="2" width="2" height="2" fill={color} />
        <rect x="7" y="4" width="2" height="2" fill={color} />
        <rect x="5" y="6" width="2" height="4" fill={color} />
        <rect x="7" y="10" width="2" height="2" fill={color} />
        <rect x="9" y="12" width="2" height="2" fill={color} />
      </svg>
    );
  }
  if (dir === 'up') {
    return (
      <svg {...svgProps(size, className)}>
        <rect x="6" y="4" width="4" height="2" fill={color} />
        <rect x="4" y="6" width="2" height="2" fill={color} />
        <rect x="10" y="6" width="2" height="2" fill={color} />
        <rect x="2" y="8" width="2" height="2" fill={color} />
        <rect x="12" y="8" width="2" height="2" fill={color} />
      </svg>
    );
  }
  if (dir === 'down') {
    return (
      <svg {...svgProps(size, className)}>
        <rect x="2" y="5" width="2" height="2" fill={color} />
        <rect x="12" y="5" width="2" height="2" fill={color} />
        <rect x="4" y="7" width="2" height="2" fill={color} />
        <rect x="10" y="7" width="2" height="2" fill={color} />
        <rect x="6" y="9" width="4" height="2" fill={color} />
      </svg>
    );
  }
  return (
    <svg {...svgProps(size, className)}>
      <rect x="5" y="2" width="2" height="2" fill={color} />
      <rect x="7" y="4" width="2" height="2" fill={color} />
      <rect x="9" y="6" width="2" height="4" fill={color} />
      <rect x="7" y="10" width="2" height="2" fill={color} />
      <rect x="5" y="12" width="2" height="2" fill={color} />
    </svg>
  );
};

// ==================== 6 STAT PIXEL ICONS ====================

export const PxStatInt: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#3b82c4',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="3" y="2" width="10" height="12" fill="#29568c" />
    <rect x="2" y="2" width="2" height="12" fill="#1f4878" />
    <rect x="5" y="4" width="6" height="4" fill="#bce0ff" />
    <rect x="6" y="5" width="4" height="2" fill={color} />
    <rect x="5" y="10" width="6" height="1" fill="#f0c46c" />
  </svg>
);

export const PxStatPer: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#74ace8',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="3" width="8" height="2" fill={color} />
    <rect x="2" y="5" width="12" height="6" fill="#29568c" />
    <rect x="4" y="11" width="8" height="2" fill={color} />
    <rect x="6" y="6" width="4" height="4" fill="#f0c46c" />
    <rect x="7" y="7" width="2" height="2" fill="#09070f" />
  </svg>
);

export const PxStatStr: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#c99330',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="5" y="2" width="6" height="4" fill={color} />
    <rect x="9" y="5" width="4" height="5" fill="#f0c46c" />
    <rect x="4" y="6" width="5" height="6" fill="#b83a4b" />
    <rect x="3" y="10" width="10" height="4" fill={color} />
  </svg>
);

export const PxStatVit: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#b83a4b',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="3" y="3" width="4" height="2" fill={color} />
    <rect x="9" y="3" width="4" height="2" fill={color} />
    <rect x="2" y="5" width="12" height="4" fill={color} />
    <rect x="4" y="5" width="2" height="2" fill="#e86b7a" />
    <rect x="4" y="9" width="8" height="2" fill={color} />
    <rect x="6" y="11" width="4" height="2" fill="#8c2030" />
    <rect x="7" y="13" width="2" height="1" fill="#8c2030" />
  </svg>
);

export const PxStatAgi: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#52c484',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="2" width="5" height="2" fill={color} />
    <rect x="6" y="4" width="7" height="2" fill={color} />
    <rect x="2" y="7" width="9" height="2" fill="#2e8b57" />
    <rect x="5" y="10" width="7" height="2" fill={color} />
    <rect x="3" y="12" width="5" height="2" fill="#f0c46c" />
  </svg>
);

export const PxStatCha: React.FC<PixelIconProps> = ({
  size = 16,
  color = '#b792e0',
  className,
}) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="4" width="2" height="7" fill="#c99330" />
    <rect x="7" y="2" width="2" height="9" fill="#f0c46c" />
    <rect x="12" y="4" width="2" height="7" fill="#c99330" />
    <rect x="4" y="6" width="8" height="5" fill="#c99330" />
    <rect x="3" y="11" width="10" height="3" fill={color} />
    <rect x="7" y="8" width="2" height="2" fill={color} />
  </svg>
);
