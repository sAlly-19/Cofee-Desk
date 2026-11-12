import type { CSSProperties } from "react";
export function CoffeeDeskLogo({
  size = 48,
  color = "#d88a43",
  className = "",
  style = {},
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={["coffee-desk-logo", className].filter(Boolean).join(" ")}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="coffee-logo-steam" d="M32 7c7 8-8 8-3 16" />
        <g className="coffee-logo-cup">
          <path d="M13 28h35v9c0 10-6 17-17.5 17S13 47 13 37V28Z" />
          <path d="M48 32h5c10 0 7 14-6 14" />
        </g>
        <path d="M10 58h40" />
      </g>
    </svg>
  );
}
