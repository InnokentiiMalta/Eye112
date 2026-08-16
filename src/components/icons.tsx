interface IconProps {
  className?: string;
}

const base = (className?: string) => ({
  className: className ?? 'w-4 h-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
});

export const IconRadar = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 12 19 5" />
    <path d="M19 5a9.9 9.9 0 1 1-7-2.9" />
    <path d="M15.5 8.5A5 5 0 1 0 17 12" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconFlame = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 22c4.4 0 7-2.8 7-6.5 0-3.2-2.2-5.3-3.9-7C13.6 7 13 5 13 3c-3 2-4.2 4.6-4 7-.9-.4-1.6-1.2-2-2.3C5.6 9.2 5 11 5 13.5 5 19.2 7.6 22 12 22Z" />
    <path d="M12 22c2 0 3.2-1.5 3.2-3.4 0-1.8-1.2-2.9-2.2-4-.6-.7-1-1.5-1-2.6-1.6 1.2-3.2 3.3-3.2 5.6 0 2.4 1.2 4.4 3.2 4.4Z" />
  </svg>
);

export const IconSmoke = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 8h9a3 3 0 1 0-3-3" />
    <path d="M3 12h13a3 3 0 1 1-3 3" />
    <path d="M3 16h5" />
  </svg>
);

export const IconDroplet = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
    <path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" />
  </svg>
);

export const IconCollapse = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 21h18" />
    <path d="M5 21V9l4-3v15" />
    <path d="M9 21V6l6 2" />
    <path d="m15 8 4 2v11" />
    <path d="m12 12 2.5 2-2 2 3 3" />
  </svg>
);

export const IconTerrain = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m3 17 5-8 3 4 3-6 7 10Z" />
    <path d="M3 21h18" />
  </svg>
);

export const IconUnknown = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCamera = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="2" y="7" width="14" height="10" rx="2" />
    <path d="m16 10 6-3v10l-6-3" />
  </svg>
);

export const IconUpload = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const IconReset = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const IconSnapshot = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <circle cx="12" cy="13" r="4" />
    <path d="M8 6 9.5 3h5L16 6" />
  </svg>
);

export const IconDoc = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 2h8l4 4v16H6Z" />
    <path d="M14 2v4h4" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

export const IconGrid = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </svg>
);

export const IconBoxFrame = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
    <circle cx="12" cy="12" r="2.4" />
  </svg>
);

export const IconThermo = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
    <path d="M12 9v7" />
  </svg>
);

export const IconHeat = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 14c2-4 4-4 6 0s4 4 6 0 3-3 4-1" />
    <path d="M4 19c2-4 4-4 6 0s4 4 6 0 3-3 4-1" />
    <path d="M8 9c1.5-3 3-3 4.5 0" />
  </svg>
);

export const IconEye = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const IconCompare = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M12 2v20" strokeDasharray="3 2.4" />
    <path d="m7 10-2 2 2 2M17 10l2 2-2 2" />
  </svg>
);

export const IconAlert = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3 1.8 20.2h20.4Z" />
    <path d="M12 9.5V14" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.6 2.6L16.5 9" />
  </svg>
);

export const IconPulse = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2 12h4l2.5-7 4 14L15 9l1.5 3H22" />
  </svg>
);
