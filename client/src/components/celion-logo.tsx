import celionLogoPath from "@assets/celion-logo.png";

interface CelionLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  textClassName?: string;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function CelionLogo({ size = "sm", showText = true, textClassName = "font-bold text-xl" }: CelionLogoProps) {
  return (
    <div className="flex items-center gap-2" data-testid="celion-logo">
      <img src={celionLogoPath} alt="Celion One" className={`${sizeMap[size]} object-contain`} />
      {showText && <span className={textClassName}>Celion One</span>}
    </div>
  );
}
