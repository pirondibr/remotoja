export function BrandMark({
  light = false,
  size = "md",
}: {
  light?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-base",
    md: "text-xl md:text-2xl",
    lg: "text-3xl md:text-5xl",
  };

  return (
    <span
      className={`font-[family-name:var(--font-display)] font-bold tracking-tight ${sizes[size]} ${
        light ? "text-cream" : "text-ink"
      }`}
    >
      Minha Vaga{" "}
      <span className={light ? "text-lime" : "text-moss"}>Remota</span>
    </span>
  );
}
