import { useId } from "react";

/**
 * The DWP Agent mark: a forward "play" ribbon in the blue-to-cyan brand
 * gradient, with the agent's dot at the top right.
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={`bm-${id}`} x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a3fc4" />
          <stop offset="0.55" stopColor="#0b63e5" />
          <stop offset="1" stopColor="#19d3f0" />
        </linearGradient>
      </defs>
      <path
        d="M7.5 8.2c0-2.3 2.5-3.7 4.5-2.5l13 7.8c1.9 1.2 1.9 3.9 0 5.1l-13 7.8c-2 1.2-4.5-.2-4.5-2.5V8.2Z"
        stroke={`url(#bm-${id})`}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="5.5" r="3" fill="#19d3f0" />
    </svg>
  );
}
