import type { CSSProperties } from "react";
export function CoffeeDeskLogo({
  size = 48,
  className = "",
  style = {},
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src="./brand/coffee-mark.svg"
      width={size}
      height={size}
      className={className}
      style={style}
      alt=""
      aria-hidden="true"
    />
  );
}
