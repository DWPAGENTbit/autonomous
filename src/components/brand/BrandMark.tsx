import { useId } from "react";

/**
 * The DWP mark (owner-supplied logo, redrawn as SVG): a folded blue-to-cyan
 * ribbon forming a forward "play" shape, with the agent's dot at the top right.
 * Colors are fixed brand colors and do not follow the UI theme.
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={`bm-back-${id}`} x1="20" y1="18" x2="70" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a6cff" />
          <stop offset="0.6" stopColor="#0646d8" />
          <stop offset="1" stopColor="#0a8fd8" />
        </linearGradient>
        <linearGradient id={`bm-loop-${id}`} x1="17" y1="84" x2="86" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a9cff" />
          <stop offset="0.45" stopColor="#0a63f2" />
          <stop offset="1" stopColor="#14b8f0" />
        </linearGradient>
        <linearGradient id={`bm-front-${id}`} x1="14" y1="60" x2="88" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a6cff" />
          <stop offset="0.45" stopColor="#0bb4ff" />
          <stop offset="1" stopColor="#1ff4ff" />
        </linearGradient>
        <linearGradient id={`bm-fold-${id}`} x1="36" y1="80" x2="62" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0436c2" />
          <stop offset="1" stopColor="#0a7bff" />
        </linearGradient>
        <linearGradient id={`bm-dot-${id}`} x1="66" y1="15" x2="76" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#25e3ff" />
          <stop offset="1" stopColor="#0a6cff" />
        </linearGradient>
      </defs>
      {/* Back strand: from the top-left lobe, passing under the front band */}
      <path d="M27 22 L72 49.5" stroke={`url(#bm-back-${id})`} strokeWidth="17" strokeLinecap="round" />
      {/* The loop: right tip, down to the bottom-left corner, up the left side */}
      <path d="M23 55 L80 53 L40 78 L24 69.5 Z" fill={`url(#bm-loop-${id})`} />
      <path
        d="M80 53 L40 78 L24 69.5 L23 55"
        stroke={`url(#bm-loop-${id})`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The fold: the ribbon's darker back face, shaped like a rising arrow */}
      <path d="M35.2 67.5 L63.6 52.4 L58.8 73.6 L42 83 L35.2 79.5 Z" fill={`url(#bm-fold-${id})`} />
      {/* Front band: up from the left, over the apex, to the bright right tip */}
      <path
        d="M23 60 L23 55.5 Q23 51 27 48.5 L45 37 Q49.5 34 54 36.4 L81.5 51"
        stroke={`url(#bm-front-${id})`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The opening, whose lower edge draws the arrow */}
      <path d="M35.2 53.4 L49.2 44.6 L63.6 52.4 L54 53.2 L55 56.2 L35.2 67.5 Z" fill="#ffffff" />
      <circle cx="71.6" cy="24" r="9.6" fill={`url(#bm-dot-${id})`} />
    </svg>
  );
}

/** The written name. "EARN MONEY" carries the logo's blue-to-cyan gradient. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={`text-[12px] font-semibold tracking-[0.16em] whitespace-nowrap text-ink sm:text-[13px] sm:tracking-[0.24em] ${className ?? ""}`}
    >
      DWP <span className="bg-gradient-to-r from-[#0a63f2] to-[#12c9f0] bg-clip-text text-transparent">EARN MONEY</span>
    </span>
  );
}
