import { brandColors, brandPaths } from "@/lib/brand";

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill={brandColors.background} />
      <path d={brandPaths.symbol} fill={brandColors.brand} />
    </svg>
  );
}
