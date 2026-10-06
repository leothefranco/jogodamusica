export function EncoreArt({ className }: { className?: string }) {
  return (
    <picture className={className}>
      <source
        media="(min-width: 768px)"
        srcSet="/brand/last-track-standing/encore-desktop.webp"
      />
      {/* Local, pre-optimized LTS-01 assets; explicit dimensions reserve layout. */}
      <img
        src="/brand/last-track-standing/encore-mobile.webp"
        width={640}
        height={640}
        alt=""
      />
    </picture>
  );
}
