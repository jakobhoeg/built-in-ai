import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CornerPlusProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function CornerPlus({
  className,
  size = 7,
  strokeWidth = 1,
}: CornerPlusProps) {
  const sizeClass = `size-${size}`;
  const baseClass = cn(
    "absolute text-muted-foreground/50 pointer-events-none hidden sm:inline-block",
    sizeClass,
    className,
  );
  const offset = `-${(size / 2) * 0.25}rem`;

  return (
    <>
      <Plus
        className={cn(baseClass, "-top-3 -left-3")}
        aria-hidden="true"
        strokeWidth={strokeWidth}
      />
      <Plus
        className={cn(baseClass, "-top-3 -right-3")}
        aria-hidden="true"
        strokeWidth={strokeWidth}
      />
      <Plus
        className={cn(baseClass, "-bottom-3 -left-3")}
        aria-hidden="true"
        strokeWidth={strokeWidth}
      />
      <Plus
        className={cn(baseClass, "-bottom-3 -right-3")}
        aria-hidden="true"
        strokeWidth={strokeWidth}
      />
    </>
  );
}
