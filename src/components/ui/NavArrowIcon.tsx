/**
 * Ícone padronizado de seta para navegação (voltar/avançar).
 * Chevron roxo claro com brilho sutil, usado em links e botões de navegação.
 */
export function NavArrowIcon({
  direction = "back",
  className = "h-4 w-4",
  "aria-hidden": ariaHidden = true,
}: {
  direction?: "back" | "forward";
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      style={{
        filter: "drop-shadow(0 0 3px currentColor)",
      }}
    >
      {direction === "back" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}
