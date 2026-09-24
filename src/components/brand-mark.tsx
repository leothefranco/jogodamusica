import { brandPaths } from "@/lib/brand";

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill="#101216" />
      <path d={brandPaths.blue} fill="#38BDF8" />
      <path d={brandPaths.orange} fill="#FF923D" />
    </svg>
  );
}
