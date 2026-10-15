export function BrandMark({
  light = false,
  size = "md",
}: {
  light?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl md:text-5xl",
  };

  return (
    <span
      className={`font-[family-name:var(--font-display)] font-bold tracking-tight ${sizes[size]} ${
        light ? "text-cream" : "text-ink"
      }`}
    >
      Remoto
      <span className={light ? "text-lime" : "text-moss"}>Já</span>
    </span>
  );
}
