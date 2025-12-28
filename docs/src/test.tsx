import { cn } from "./lib/utils";

function Separator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-full border-y border-edge [--pattern-fg:var(--color-black)]/5 dark:[--pattern-fg:var(--color-white)]/10",
        // Pattern within the content area
        "bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed",
        // Extend pattern to the left (skipping gutter on md+)
        "before:absolute before:-z-1 before:h-10 before:w-[100vw] before:right-full",
        "before:bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] before:bg-[size:10px_10px] before:bg-fixed",
        "md:before:right-[calc(100%+var(--gutter-width))]",
        // Extend pattern to the right (skipping gutter on md+)
        "after:absolute after:-z-1 after:h-10 after:w-[100vw] after:left-full",
        "after:bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] after:bg-[size:10px_10px] after:bg-fixed",
        "md:after:left-[calc(100%+var(--gutter-width))]",
        className,
      )}
    />
  );
}

function VerticalSeparatorRight({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "row-span-full row-start-1 hidden md:col-start-3 md:block",
        "border-x border-x-(--pattern-fg) [--pattern-fg:var(--color-black)]/5 dark:[--pattern-fg:var(--color-white)]/10",
        "bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed",
        // Mask to create transparent gap where horizontal separator is
        "[mask-image:linear-gradient(to_bottom,black_4rem,transparent_4rem,transparent_calc(4rem+2.5rem),black_calc(4rem+2.5rem))]",
        "sm:[mask-image:linear-gradient(to_bottom,black_6rem,transparent_6rem,transparent_calc(6rem+2.5rem),black_calc(6rem+2.5rem))]",
        className,
      )}
    />
  );
}

function VerticalSeparatorLeft({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "col-start-1 row-span-full row-start-1 hidden md:block",
        "border-x border-x-(--pattern-fg) [--pattern-fg:var(--color-black)]/5 dark:[--pattern-fg:var(--color-white)]/10",
        "bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed",
        // Mask to create transparent gap where horizontal separator is
        "[mask-image:linear-gradient(to_bottom,black_4rem,transparent_4rem,transparent_calc(4rem+2.5rem),black_calc(4rem+2.5rem))]",
        "sm:[mask-image:linear-gradient(to_bottom,black_6rem,transparent_6rem,transparent_calc(6rem+2.5rem),black_calc(6rem+2.5rem))]",
        className,
      )}
    />
  );
}
