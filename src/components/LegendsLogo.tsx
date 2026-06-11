import logoAsset from "@/assets/legends-arena-logo.png.asset.json";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
  xl: "h-40 w-40 md:h-56 md:w-56",
} as const;

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}

export function LegendsLogo({ size = "md", className, alt = "Legends Arena" }: Props) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={cn(SIZES[size], "object-contain drop-shadow-[0_0_20px_oklch(0.72_0.145_221_/_0.35)]", className)}
      draggable={false}
    />
  );
}
