interface CelionLogoProps {
  textClassName?: string;
}

export function CelionLogo({ textClassName = "font-bold text-xl" }: CelionLogoProps) {
  return (
    <span className={textClassName} data-testid="celion-logo">Cellion One</span>
  );
}
