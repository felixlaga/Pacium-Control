interface IconProps {
  size?: number;
}

function iconAttributes(size: number) {
  return {
    "aria-hidden": true as const,
    fill: "none",
    height: size,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.2,
    viewBox: "0 0 16 16",
    width: size,
  };
}

export function PanelLeftIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <rect height="10.5" rx="2" width="12.5" x="1.75" y="2.75" />
      <path d="M6.25 2.75v10.5" />
    </svg>
  );
}

export function PanelRightIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <rect height="10.5" rx="2" width="12.5" x="1.75" y="2.75" />
      <path d="M9.75 2.75v10.5" />
    </svg>
  );
}

export function SettingsIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M2 4.75h6.5M12.75 4.75H14M2 11.25h1.25M7.5 11.25H14" />
      <circle cx="10.6" cy="4.75" r="1.9" />
      <circle cx="5.4" cy="11.25" r="1.9" />
    </svg>
  );
}

export function SplitRightIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <rect height="10.5" rx="2" width="12.5" x="1.75" y="2.75" />
      <path d="M8 2.75v10.5" />
    </svg>
  );
}

export function SplitDownIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <rect height="10.5" rx="2" width="12.5" x="1.75" y="2.75" />
      <path d="M1.75 8h12.5" />
    </svg>
  );
}
